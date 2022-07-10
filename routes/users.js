const express = require("express");
const router = express.Router();
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const uid2 = require("uid2");

//import du model User
const User = require("../models/User");

//Route pour créer un compte
router.post("/user/signup", async (req, res) => {
  try {
    // console.log(req.body);
    //on vient vérifier qu'on envoie bien un username
    if (req.body.username === undefined) {
      res.status(400).json({ message: "Missing parameter" });
    } else {
      //On vérifie que l'email en base de données soit bien disponible
      const isEmailAlreadyinDb = await User.findOne({ email: req.body.email });

      if (isEmailAlreadyinDb !== null) {
        res.json({ message: "This email already has an account" });
      } else {
        // Etape 1 : hasher le mot de passe
        const salt = uid2(16);
        const hash = SHA256(req.body.password + salt).toString(encBase64);
        const token = uid2(32);
        console.log("salt==>", salt);
        console.log("hash==>", hash);

        // Etape 2 : créer le nouvel utilisateur
        const newUser = new User({
          email: req.body.email,
          account: {
            username: req.body.username,
          },
          newsletter: req.body.newsletter,
          token: token,
          hash: hash,
          salt: salt,
        });

        // Etape 3 : sauvegarder le nouvel utilisateur dans la BDD
        await newUser.save();
        res.json({
          _id: newUser._id,
          email: newUser.email,
          token: newUser.token,
          account: newUser.account,
        });
      }
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

//Route pour me connecter à un compte
router.post("/user/login", async (req, res) => {
  try {
    const userToCheck = await User.findOne({ email: req.body.email });
    if (userToCheck === null) {
      res.status(401).json({ message: "Unauthorized 1" });
    } else {
      const newHash = SHA256(req.body.password + userToCheck.salt).toString(
        encBase64
      );
      console.log("newHash ==>", newHash);
      console.log("Hash présent en BDD ==>", userToCheck.hash);

      //on vient comparer notre nouveau hash à celui présent en BDD
      if (newHash === userToCheck.hash) {
        res.json({
          _id: userToCheck._id,
          token: userToCheck.token,
          account: userToCheck.account,
        });
      } else {
        res.status(401).json({ message: "Unauthorized 2" });
      }
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
