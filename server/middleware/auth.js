import User from "../models/User.js";

import getFirebaseAdmin from "../config/firebaseAdmin.js";

// ==================================================
// REQUIRE VALID FIREBASE LOGIN
// ==================================================

export async function requireAuth(
  req,
  res,
  next
) {
  try {
    const header =
      req.headers.authorization ||
      "";

    if (
      !header.startsWith(
        "Bearer "
      )
    ) {
      return res.status(
        401
      ).json({
        message:
          "Authentication required.",
      });
    }

    const token =
      header.substring(
        7
      );

    const firebaseAuth =
      getFirebaseAdmin();

    const decoded =
      await firebaseAuth.verifyIdToken(
        token
      );

    const firebaseUid =
      decoded.uid;

    const email =
      (
        decoded.email ||
        ""
      ).toLowerCase()
        .trim();

    const name =
      decoded.name ||
      email ||
      "GG Matchday User";

    const photoURL =
      decoded.picture ||
      "";

    let user =
      await User.findOne({
        firebaseUid,
      });

    // ------------------------------------------------
    // CREATE FIRST RECORD IF NEEDED
    // ------------------------------------------------

    if (!user) {
      const configuredAdminEmail =
        (
          process.env.ADMIN_EMAIL ||
          ""
        ).toLowerCase()
          .trim();

      const role =
        email &&
        email ===
          configuredAdminEmail
          ? "admin"
          : "viewer";

      user =
        await User.create({
          firebaseUid,

          email,

          name,

          profileImage: photoURL,

          role,

          accessRequest:
            "none",
        });
    } else {
      // Keep profile information synced.
      user.email =
        email ||
        user.email;

      user.name =
        name ||
        user.name;

      user.profileImage =
        photoURL ||
        user.profileImage ||
        "";

      // ------------------------------------------------
      // ADMIN EMAIL ALWAYS REMAINS ADMIN
      // ------------------------------------------------

      const configuredAdminEmail =
        (
          process.env.ADMIN_EMAIL ||
          ""
        ).toLowerCase()
          .trim();

      if (
        email &&
        email ===
          configuredAdminEmail
      ) {
        user.role =
          "admin";

        user.accessRequest =
          "none";
      }

      await user.save();
    }

    req.firebaseUser =
      decoded;

    req.user =
      user;

    next();
  } catch (error) {
    console.error(
      "Authentication error:",
      error.message
    );

    return res.status(
      401
    ).json({
      message:
        "Invalid or expired authentication token.",
    });
  }
}

// ==================================================
// REQUIRE EDITOR OR ADMIN
// ==================================================

export async function requireEditor(
  req,
  res,
  next
) {
  try {
    if (
      !req.user
    ) {
      return res.status(
        401
      ).json({
        message:
          "Authentication required.",
      });
    }

    if (
      req.user.role !==
        "editor" &&
      req.user.role !==
        "admin"
    ) {
      return res.status(
        403
      ).json({
        message:
          "Editor access required.",
      });
    }

    next();
  } catch (error) {
    console.error(
      "Editor authorization error:",
      error
    );

    return res.status(
      403
    ).json({
      message:
        "Editor access denied.",
    });
  }
}

// ==================================================
// REQUIRE ADMIN
// ==================================================

export async function requireAdmin(
  req,
  res,
  next
) {
  try {
    if (
      !req.user
    ) {
      return res.status(
        401
      ).json({
        message:
          "Authentication required.",
      });
    }

    if (
      req.user.role !==
      "admin"
    ) {
      return res.status(
        403
      ).json({
        message:
          "Admin access required.",
      });
    }

    next();
  } catch (error) {
    console.error(
      "Admin authorization error:",
      error
    );

    return res.status(
      403
    ).json({
      message:
        "Admin access denied.",
    });
  }
}
export function optionalAuth(req,res,next) { return req.headers.authorization ? requireAuth(req,res,next) : next(); }
