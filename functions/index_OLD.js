const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.assignUserRole = functions.auth.user().onCreate(async (user) => {
  console.log(`[Cloud Function] assignUserRole disparada ` +
    `para el usuario: ${user.uid} (${user.email})`);
  const userRef = db.collection("users").doc(user.uid);

  try {
    const usersCollection = await db.collection("users").get();
    const isFirstUser = usersCollection.empty;

    let roleToAssign;
    if (isFirstUser) {
      const initialUsersSnapshot = await db.collection("users").listDocuments();
      if (initialUsersSnapshot.length === 0) {
        roleToAssign = "administrador";
      } else {
        roleToAssign = "mesero";
      }
    } else {
      roleToAssign = "mesero";
    }

    await userRef.set({
      name: user.displayName || user.email,
      email: user.email,
      role: roleToAssign,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      active: true,
      description: "",
    }, {merge: true});


    console.log(`Usuario ${user.uid} (${user.email}) ` +
        `registrado con rol: ${roleToAssign}`);
  } catch (error) {
    console.error("Error al asignar rol al usuario:", error);
  }
});
