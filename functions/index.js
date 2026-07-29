// Sucomi/functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {onUserCreated} = require("firebase-functions/v2/auth");
const {onCall} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");

const APP_CONSTANTS = {
  COLLECTIONS: {
    USERS: "users",
    EMPLEADOS: "empleados",
    REPORTS: "reports",
    ORDERS: "orders",
  },
  ROLES: {
    ADMIN: "administrador",
    CHEF: "chef",
    WAITER: "mesero",
  },
  ORDER_STATUS: {
    PAID: "paid",
  },
  TEMP_DISPLAY_NAME: "__SUCOMI_EMPLOYEE__",
  ARCHIVE_PAGE_SIZE: 200,
  FIRESTORE_BATCH_LIMIT: 450,
};

const deleteCollectionInBatches = async (collectionRef, pageSize = APP_CONSTANTS.ARCHIVE_PAGE_SIZE) => {
  let lastDoc = null;
  while (true) {
    let query = collectionRef.orderBy("__name__").limit(pageSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    const batch = admin.firestore().batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    if (snapshot.size < pageSize) {
      break;
    }
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }
};

admin.initializeApp();

// 💡 CONFIGURACIÓN GLOBAL DE GEN2 
setGlobalOptions({
  region: "us-central1", // Usa la región de tu proyecto
  memory: "256Mi",
});

// ====================================================================
// FUNCIÓN 1: assignUserRole (GEN2)
// ====================================================================
exports.assignUserRole = onUserCreated(async (event) => {
  const user = event.data;
  if (!user || !user.uid) {
    console.error(
        "Error: El objeto de usuario es nulo o indefinido, " +
        "o falta el UID.",
    );
    return null;
  }

  console.log(
      `Cloud Function activada para el usuario: ${user.uid}`,
  );
  console.log(
      `Correo electrónico del usuario: ${user.email || "N/A"}`,
  );

  // 💡 CORRECCIÓN CLAVE:
  // La función `registrarEmpleado_v2` crea al empleado con un displayName temporal.
  // Si este displayName está presente, significa que el usuario fue creado internamente
  // y `assignUserRole` no debe intervenir.
  if (user.displayName === APP_CONSTANTS.TEMP_DISPLAY_NAME) {
    console.log(`Usuario ${user.uid} identificado como empleado. 'assignUserRole' no tomará acción.`);
    return null;
  }

  const userRecord = await admin.auth().getUser(user.uid);
  if (userRecord.customClaims && userRecord.customClaims.role) {
    console.log(`El usuario ${user.uid} ya tiene el rol '${userRecord.customClaims.role}'. La función assignUserRole no hará nada.`);
    return null;
  }

  const db = admin.firestore();
  const userRef = db.collection(APP_CONSTANTS.COLLECTIONS.USERS).doc(user.uid);

  try {
    const userRole = APP_CONSTANTS.ROLES.ADMIN;

    console.log(
        `Asignando rol de '${userRole}' al usuario ${user.uid}.`,
    );

    const dataToSet = {
      email: user.email || "",
      displayName: user.displayName || user.email.split("@")[0],
      role: userRole,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      empleados: [],
    };

    await userRef.set(dataToSet, {merge: true});

    console.log(
        `Documento de Administrador creado para ${user.uid}.`,
    );

    await admin.auth().setCustomUserClaims(user.uid, {role: userRole});
    console.log(
        `Custom Claim '{ role: "${userRole}" }' establecido para ${user.uid}.`,
    );

    return null;
  } catch (error) {
    console.error(
        `Error en assignUserRole para el usuario ${user.uid}:`,
        error,
    );
    return null;
  }
});


// ================================================
// FUNCIÓN 2: registrarEmpleado_v2 (SIN CAMBIOS)
// ================================================

exports.registrarEmpleado_v2 = onCall(async (request) => {
  // En Gen2: request.auth y request.data
  const context = request.auth;
  const data = request.data;
  const db = admin.firestore();

  // 1. Verificación de administrador
  if (!context || context.token.role !== APP_CONSTANTS.ROLES.ADMIN) {
    throw new functions.https.HttpsError(
        "permission-denied",
        "Solo los administradores pueden registrar nuevos usuarios.",
    );
  }

  const {email, password, displayName, role} = data;
  const adminId = context.uid;

  // 2. Verificación de argumentos y seguridad
  if (!email || !password || !displayName || !role || password.length < 6) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Faltan datos requeridos (email, password > 6 chars, nombre, rol).",
    );
  }

  try {
    // 3. Crear usuario en Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      // 💡 CAMBIO: Se crea con un nombre temporal para que el trigger `assignUserRole` lo ignore.
      displayName: APP_CONSTANTS.TEMP_DISPLAY_NAME,
    });

    const employeeUid = userRecord.uid;
    
    // 4. Asignar el Custom Claim al nuevo empleado
    await admin.auth().setCustomUserClaims(employeeUid, {
      role: role,
      adminId: adminId, // <-- ¡CAMBIO CLAVE! Añadimos el ID del admin al token.
    });

    // 💡 CAMBIO: Ahora actualizamos el perfil para poner el nombre correcto.
    await admin.auth().updateUser(employeeUid, {
      displayName: displayName,
    });

    // 5. Guardar el documento del empleado en la subcolección
    const employeeDocRef = db.collection(APP_CONSTANTS.COLLECTIONS.USERS)
        .doc(adminId)
        .collection(APP_CONSTANTS.COLLECTIONS.EMPLEADOS)
        .doc(employeeUid);

    await employeeDocRef.set({
      email: email,
      displayName: displayName,
      role: role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      adminId: adminId, // Guardamos también el adminId en el documento para consistencia.
    }, {merge: true});

    // 6. Actualizar el array de empleados del administrador
    const adminDocRef = db.collection("users").doc(adminId);
    await adminDocRef.update({
      empleados: admin.firestore.FieldValue.arrayUnion(employeeUid),
    });

    return {
      message: `¡Usuario ${displayName} (${role}) registrado exitosamente!`,
    };
  } catch (error) {
    console.error("Error al crear usuario en Cloud Function:", error);

    // Manejo de errores específicos
    if (error.code === "auth/email-already-in-use") {
      throw new functions.https.HttpsError(
          "already-exists",
          "El correo electrónico ya está en uso.",
      );
    } else {
      // Lanzar un error interno para el resto
      throw new functions.https.HttpsError("internal", error.message);
    }
  }
});

// ==================================================
// FUNCIÓN 3: eliminarEmpleado_v2 (NUEVA - GEN2)
// ==================================================
exports.eliminarEmpleado_v2 = onCall(async (request) => {
  const context = request.auth;
  const data = request.data;
  const db = admin.firestore();

  if (!context || context.token.role !== APP_CONSTANTS.ROLES.ADMIN) {
    throw new functions.https.HttpsError(
        "permission-denied",
        "Solo los administradores pueden eliminar empleados.",
    );
  }

  const adminId = context.uid;
  const {employeeId} = data || {};

  if (!employeeId || typeof employeeId !== "string") {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Se requiere el ID del empleado a eliminar.",
    );
  }

  if (employeeId === adminId) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Un administrador no puede eliminarse desde esta pantalla.",
    );
  }

  const employeeDocRef = db.collection(APP_CONSTANTS.COLLECTIONS.USERS)
      .doc(adminId)
      .collection(APP_CONSTANTS.COLLECTIONS.EMPLEADOS)
      .doc(employeeId);
  const adminDocRef = db.collection(APP_CONSTANTS.COLLECTIONS.USERS).doc(adminId);

  try {
    const employeeDoc = await employeeDocRef.get();
    if (!employeeDoc.exists) {
      throw new functions.https.HttpsError(
          "not-found",
          "El empleado no existe o ya fue eliminado.",
      );
    }

    let authUserExists = true;
    try {
      const userRecord = await admin.auth().getUser(employeeId);
      const claims = userRecord.customClaims || {};
      const isEmployee = claims.role === APP_CONSTANTS.ROLES.CHEF || claims.role === APP_CONSTANTS.ROLES.WAITER;

      if (!isEmployee || claims.adminId !== adminId) {
        throw new functions.https.HttpsError(
            "failed-precondition",
            "El usuario de Auth no pertenece a este administrador.",
        );
      }
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        authUserExists = false;
      } else {
        throw error;
      }
    }

    if (authUserExists) {
      await admin.auth().deleteUser(employeeId);
    }

    const batch = db.batch();
    batch.delete(employeeDocRef);
    batch.update(adminDocRef, {
      empleados: admin.firestore.FieldValue.arrayRemove(employeeId),
    });
    await batch.commit();

    return {message: "El empleado fue eliminado completamente."};
  } catch (error) {
    console.error("Error al eliminar empleado:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// ==================================================
// FUNCIÓN 4: archiveOrders (NUEVA - GEN2)
// ==================================================
exports.archiveOrders = onCall(async (request) => {
  const context = request.auth;
  const data = request.data;
  const db = admin.firestore();

  // 1. Verificación de administrador
  if (!context || context.token.role !== APP_CONSTANTS.ROLES.ADMIN) {
    throw new functions.https.HttpsError(
        "permission-denied",
        "Solo los administradores pueden archivar órdenes.",
    );
  }

  const adminId = context.uid;
  let {reportName, reportId, orderId} = data;

  // 2. Lógica para crear o usar un reporte existente
  const reportsRef = db.collection(APP_CONSTANTS.COLLECTIONS.USERS).doc(adminId).collection(APP_CONSTANTS.COLLECTIONS.REPORTS);
  let targetReportRef;

  if (reportId) {
    // Usar un reporte existente
    targetReportRef = reportsRef.doc(reportId);
    const reportSnap = await targetReportRef.get();
    if (!reportSnap.exists) {
      throw new functions.https.HttpsError(
          "not-found", "El reporte seleccionado no existe.",
      );
    }
    reportName = reportSnap.data().reportName; // Asegurarse de tener el nombre
  } else if (reportName) {
    // Crear un nuevo reporte
    targetReportRef = reportsRef.doc(); // Firestore genera un ID automático
    await targetReportRef.set({
      reportName: reportName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      totalPaidAmount: 0,
      ordersCount: 0,
    });
    reportId = targetReportRef.id;
  } else {
    throw new functions.https.HttpsError(
        "invalid-argument", "Se requiere un nombre de reporte o un ID.",
    );
  }

  // 3. Obtener las órdenes a archivar
  const ordersToArchiveRef = db.collection(APP_CONSTANTS.COLLECTIONS.USERS).doc(adminId).collection(APP_CONSTANTS.COLLECTIONS.ORDERS);
  const ordersInReportRef = targetReportRef.collection(APP_CONSTANTS.COLLECTIONS.ORDERS);
  let newOrdersCount = 0;
  let newTotalPaidAmount = 0;

  if (orderId) {
    // Archivar una sola orden
    const singleOrderSnap = await ordersToArchiveRef.doc(orderId).get();
    if (!singleOrderSnap.exists) {
      throw new functions.https.HttpsError("not-found", "La orden a archivar no fue encontrada.");
    }

    const orderData = singleOrderSnap.data();
    const batch = db.batch();
    const newOrderInReportRef = ordersInReportRef.doc(singleOrderSnap.id);

    batch.set(newOrderInReportRef, orderData);
    newOrdersCount = 1;
    if (orderData.status === APP_CONSTANTS.ORDER_STATUS.PAID) {
      newTotalPaidAmount = parseFloat(orderData.total || 0);
    }

    batch.update(targetReportRef, {
      ordersCount: admin.firestore.FieldValue.increment(newOrdersCount),
      totalPaidAmount: admin.firestore.FieldValue.increment(newTotalPaidAmount),
    });

    await batch.commit();
    return {
      message: `Orden guardada exitosamente en el reporte '${reportName}'.`,
    };
  }

  // Archivar todas las órdenes en páginas para evitar límites de batch y de memoria.
  let lastDoc = null;
  while (true) {
    let pageQuery = ordersToArchiveRef.orderBy("__name__").limit(APP_CONSTANTS.ARCHIVE_PAGE_SIZE);
    if (lastDoc) {
      pageQuery = pageQuery.startAfter(lastDoc);
    }

    const pageSnapshot = await pageQuery.get();
    if (pageSnapshot.empty) {
      break;
    }

    const batch = db.batch();
    pageSnapshot.docs.forEach((doc) => {
      const orderData = doc.data();
      const newOrderInReportRef = ordersInReportRef.doc(doc.id);

      batch.set(newOrderInReportRef, orderData);
      batch.delete(doc.ref);

      newOrdersCount++;
      if (orderData.status === APP_CONSTANTS.ORDER_STATUS.PAID) {
        newTotalPaidAmount += parseFloat(orderData.total || 0);
      }
    });

    await batch.commit();

    if (pageSnapshot.size < APP_CONSTANTS.ARCHIVE_PAGE_SIZE) {
      break;
    }

    lastDoc = pageSnapshot.docs[pageSnapshot.docs.length - 1];
  }

  if (newOrdersCount === 0) {
    return {message: "No hay órdenes para archivar."};
  }

  await targetReportRef.update({
    ordersCount: admin.firestore.FieldValue.increment(newOrdersCount),
    totalPaidAmount: admin.firestore.FieldValue.increment(newTotalPaidAmount),
  });

  return {
    message: `${newOrdersCount} órdenes han sido archivadas en '${reportName}' y la vista principal ha sido limpiada.`,
  };
});

// ==================================================
// FUNCIÓN 4: eliminarHistorial_v2 (NUEVA - GEN2)
// ==================================================
exports.eliminarHistorial_v2 = onCall(async (request) => {
  const context = request.auth;
  const db = admin.firestore();

  // 1. Verificación de administrador
  if (!context || context.token.role !== APP_CONSTANTS.ROLES.ADMIN) {
    throw new functions.https.HttpsError(
        "permission-denied",
        "Solo los administradores pueden borrar el historial.",
    );
  }

  const adminId = context.uid;
  const reportsRef = db.collection(APP_CONSTANTS.COLLECTIONS.USERS).doc(adminId).collection(APP_CONSTANTS.COLLECTIONS.REPORTS);

  try {
    let lastReportDoc = null;
    let deletedReportsCount = 0;

    while (true) {
      let reportQuery = reportsRef.orderBy("__name__").limit(APP_CONSTANTS.ARCHIVE_PAGE_SIZE);
      if (lastReportDoc) {
        reportQuery = reportQuery.startAfter(lastReportDoc);
      }

      const reportSnapshot = await reportQuery.get();
      if (reportSnapshot.empty) {
        break;
      }

      for (const reportDoc of reportSnapshot.docs) {
        await deleteCollectionInBatches(reportDoc.ref.collection(APP_CONSTANTS.COLLECTIONS.ORDERS));
        await reportDoc.ref.delete();
        deletedReportsCount += 1;
      }

      if (reportSnapshot.size < APP_CONSTANTS.ARCHIVE_PAGE_SIZE) {
        break;
      }
      lastReportDoc = reportSnapshot.docs[reportSnapshot.docs.length - 1];
    }

    if (deletedReportsCount === 0) {
      return {message: "No hay reportes archivados para eliminar."};
    }

    return {message: "El historial ha sido eliminado correctamente."};
  } catch (error) {
    console.error("Error al borrar historial:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});
