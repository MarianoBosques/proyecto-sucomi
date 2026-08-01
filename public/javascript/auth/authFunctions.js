// javascript/auth/authFunctions.js

import { auth, db, app, functions, googleProvider, facebookProvider } from './firebaseConfig.js'; 

import { 
    updateProfile, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    sendPasswordResetEmail, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc,
    collection,
    serverTimestamp,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const handleAuthError = (error) => {
    let message = '';
    switch (error.code) {
        case 'auth/email-already-in-use':
            message = 'El correo ya está registrado.';
            break;
        case 'auth/invalid-email':
            message = 'Correo electrónico inválido.';
            break;
        case 'auth/weak-password':
            message = 'La contraseña debe tener al menos 6 caracteres.';
            break;
        case 'auth/invalid-credential':
            message = 'usuario o contraseña que ingresaste es incorrecto favor de ingresar correctamente los datos';
            break;
        case 'auth/user-not-found':
            message = 'El usuario no ha sido encontrado o no existe.';
            break;
        case 'auth/wrong-password':
            message = 'Correo o contraseña incorrectos.';
            break;
        case 'auth/popup-closed-by-user':
            message = 'La ventana de autenticación fue cerrada por el usuario.';
            break;
        case 'auth/cancelled-popup-request':
            message = 'Ya hay una ventana emergente abierta para autenticación.';
            break;
        default:
            if (error.message.includes("Missing or insufficient permissions")) {
                message = "Error de autenticación: El rol no ha sido asignado correctamente. Intente de nuevo en unos segundos.";
            } else {
                const cfError = error.message.match(/\[(.*?)]/);
                if (cfError && cfError[1]) {
                    message = `Error de la Cloud Function: ${cfError[1]}`;
                } else {
                    message = `Error de autenticación: ${error.message}`;
                }
            }
    }
    return message;
};


/**
 * Función auxiliar que espera la asignación del rol.
 * Lee el Custom Claim del token de autenticación de Firebase.
 */
const waitForRoleAssignment = async (user, maxRetries = 20, delayMs = 500) => {
    let role = null;
    let retries = 0;

    while (retries < maxRetries) {
        // Forzar la actualización del token para obtener los últimos claims.
        await user.getIdToken(true);
        const tokenResult = await user.getIdTokenResult();
        role = tokenResult.claims.role;
        const adminId = tokenResult.claims.adminId; // Obtenemos el adminId.

        if (role) {
            // Para empleados, nos aseguramos que también venga el adminId.
            if (role === 'administrador' || (role !== 'administrador' && adminId)) {
                return { role, adminId };
            }
        }

        retries++;
        console.log(`Intento ${retries}/${maxRetries}: Esperando asignación de rol...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error("El rol o la información de administrador no fue asignada a tiempo. Intente de nuevo.");
}


/**
 * Registra un nuevo usuario con correo y contraseña.
 */
// 💡 CORRECCIÓN: Se elimina 'export' aquí para evitar la exportación duplicada.
const registerUser = async (userData) => { 
    try {
        const { email, password, name } = userData;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, {
            displayName: name
        });

        return {
            uid: user.uid,
            email: user.email,
            name: user.displayName,
        };
    } catch (error) {
        throw new Error(handleAuthError(error));
    }
};


const getUserSessionContext = async (user) => {
    if (!user) return null;

    const tokenResult = await user.getIdTokenResult(true);
    return {
        uid: user.uid,
        role: tokenResult.claims?.role || null,
        adminId: tokenResult.claims?.adminId || null
    };
};

export const validateSessionForLogin = async (auth, targetUserData) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !targetUserData) return;

    const currentContext = await getUserSessionContext(currentUser);
    const targetContext = {
        uid: targetUserData.uid,
        role: targetUserData.role,
        adminId: targetUserData.adminId || null
    };

    if (!currentContext) return;
    if (currentUser.uid === targetContext.uid) return;

    const sameRole = currentContext.role === targetContext.role;
    const sameRestaurant = Boolean(
        currentContext.adminId &&
        targetContext.adminId &&
        currentContext.adminId === targetContext.adminId
    );

    if (!sameRole || !sameRestaurant) {
        throw new Error('Ya existe una sesión activa para otra cuenta o restaurante. Cierra la sesión anterior antes de continuar.');
    }
};

/**
 * Inicia sesión de un usuario, espera su rol y busca su documento.
 */
// 💡 CORRECCIÓN: Se elimina 'export' aquí para evitar la exportación duplicada.
const loginUser = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 1. Espera la asignación del rol en el token de Auth (Custom Claim).
        const claims = await waitForRoleAssignment(user);
        const userRole = claims.role;

        let userDataFromFirestore = {};
        let finalDocRef;
        let readSuccessful = false;
        let retries = 0;
        const maxReadRetries = 5; 

        // 2. Bucle de Reintento para la LECTURA de Firestore.
        while (retries < maxReadRetries && !readSuccessful) {
            try {
                if (userRole === 'administrador') {
                    // --- CASO 1: Admin (solo en colección raíz /users) ---
                    finalDocRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(finalDocRef);

                    if (userDoc.exists()) {
                        userDataFromFirestore = userDoc.data();
                        readSuccessful = true;
                    } else {
                         throw new Error(`Documento de ${userRole} no encontrado en la colección principal.`);
                    }

                } else if (userRole === 'chef' || userRole === 'mesero') {
                    // 💡 CASO 2: Chef o Mesero (LECTURA DIRECTA)
                    // Ya no necesitamos buscar. Leemos el adminId del token y vamos directo al documento.
                    const adminId = claims.adminId;
                    if (!adminId) throw new Error("No se encontró el ID del administrador en el token del empleado.");

                    finalDocRef = doc(db, 'users', adminId, 'empleados', user.uid);
                    const employeeDocSnap = await getDoc(finalDocRef);

                    if (employeeDocSnap.exists()) {
                        userDataFromFirestore = employeeDocSnap.data();
                        readSuccessful = true;
                    }
                } else {
                    throw new Error(`Rol de usuario desconocido: ${userRole}.`);
                }

                // 3. Actualizar lastLogin.
                if (readSuccessful && finalDocRef && (userRole === 'administrador' || userRole === 'chef' || userRole === 'mesero')) {
                    await setDoc(finalDocRef, {
                        lastLogin: serverTimestamp()
                    }, { merge: true });
                }
                
            } catch (readError) {
                console.warn(`Error de lectura de Firestore. Reintentando... Intento ${retries + 1}. Error: ${readError.message}`);
                retries++;
                await new Promise(resolve => setTimeout(resolve, 500));
                if (retries >= maxReadRetries) throw readError;
            }
        }

        if (!readSuccessful) {
             throw new Error("Documento de usuario no encontrado. La sincronización de datos falló.");
        }

        // 4. Retornar los datos del usuario.
        return {
            uid: user.uid,
            email: user.email,
            name: user.displayName || userDataFromFirestore.displayName || user.email,
            ...userDataFromFirestore,
            role: userRole,
            adminId: userRole === 'administrador' ? user.uid : claims.adminId || null
        };
    } catch (error) {
        throw new Error(handleAuthError(error));
    }
};


/**
 * Inicia sesión de un usuario utilizando Google. 
 */
// 💡 CORRECCIÓN: Se elimina 'export' aquí para evitar la exportación duplicada.
const googleLogin = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // 1. Espera del rol (Custom Claim)
        const claims = await waitForRoleAssignment(user);
        const userRole = claims.role;
        
        let userDataFromFirestore = {};
        let finalDocRef;
        let readSuccessful = false;
        let retries = 0;
        const maxReadRetries = 5;

        // 2. Bucle de Reintento para la LECTURA de Firestore (REPLICANDO la lógica de loginUser)
        while (retries < maxReadRetries && !readSuccessful) {
            try {
                if (userRole === 'administrador') {
                    // --- CASO 1: Admin (solo en colección raíz /users) ---
                    finalDocRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(finalDocRef);

                    if (userDoc.exists()) {
                        userDataFromFirestore = userDoc.data();
                        readSuccessful = true;
                    }

                } else if (userRole === 'chef' || userRole === 'mesero') {
                    // 💡 CASO 2: Chef o Mesero (LECTURA DIRECTA)
                    // Ya no necesitamos buscar. Leemos el adminId del token y vamos directo al documento.
                    const adminId = claims.adminId;
                    if (!adminId) throw new Error("No se encontró el ID del administrador en el token del empleado.");

                    finalDocRef = doc(db, 'users', adminId, 'empleados', user.uid);
                    const employeeDocSnap = await getDoc(finalDocRef);

                    if (employeeDocSnap.exists()) {
                        userDataFromFirestore = employeeDocSnap.data();
                        readSuccessful = true;
                    }
                } else {
                    throw new Error(`Rol de usuario desconocido: ${userRole}.`);
                }

                // 3. Actualizar lastLogin.
                if (readSuccessful && finalDocRef && (userRole === 'administrador' || userRole === 'chef' || userRole === 'mesero')) {
                    await setDoc(finalDocRef, {
                        lastLogin: serverTimestamp()
                    }, { merge: true });
                }
                
            } catch (readError) {
                console.warn(`Error de lectura de Firestore. Reintentando... Intento ${retries + 1}. Error: ${readError.message}`);
                retries++;
                await new Promise(resolve => setTimeout(resolve, 500));
                if (retries >= maxReadRetries) throw readError;
            }
        }

        if (!readSuccessful) {
             throw new Error("Documento de usuario no encontrado. La sincronización de datos falló.");
        }

        // 4. Retornar los datos del usuario.
        return {
            uid: user.uid,
            email: user.email,
            name: user.displayName || userDataFromFirestore.displayName,
            ...userDataFromFirestore,
            role: userRole,
            adminId: userRole === 'administrador' ? user.uid : claims.adminId || null
        };
    } catch (error) {
        throw new Error(handleAuthError(error));
    }
};


/**
 * Llama a la Cloud Function renombrada (registrarEmpleado_v2)
 */
// 💡 CORRECCIÓN: Se elimina 'export' aquí para evitar la exportación duplicada.
const callRegisterEmployee = async (employeeData) => {
    try {
        const registerEmployeeCallable = httpsCallable(functions, 'registrarEmpleado_v2'); 
        const result = await registerEmployeeCallable(employeeData);
        return result.data;
    } catch (error) {
        throw new Error(handleAuthError(error));
    }
};


// 💡 CORRECCIÓN: Se elimina 'export' aquí para evitar la exportación duplicada.
const logoutUser = async () => {
    try {
        await signOut(auth);
        return true;
    } catch (error) {
        throw new Error(`Error al cerrar sesión: ${error.message}`);
    }
};


// 💡 CORRECCIÓN: Se elimina 'export' aquí para evitar la exportación duplicada.
const resetPassword = async (email) => {
    try {
        await sendPasswordResetEmail(auth, email);
        return true;
    } catch (error) {
        throw new Error(handleAuthError(error));
    }
};

// 💡 CORRECCIÓN: Solo se usa este bloque para exportar.
export { 
    registerUser, 
    loginUser, 
    googleLogin, 
    callRegisterEmployee, 
    logoutUser, 
    resetPassword 
};