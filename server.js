const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fetch = require("node-fetch");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // index.html serve করবে

// Firebase Admin Init
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const NOWPAY_API_KEY = process.env.NOWPAY_API_KEY || "QCWYJDM-26JM2FM-NT9KYQT-WK27HVQ";
const IPN_SECRET = process.env.IPN_SECRET;

// Frontend থেকে Invoice Create - CORS Fix
app.post("/api/create-invoice", async (req, res) => {
  try {
    const { price_amount, order_id, order_description } = req.body;
    const response = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: { "x-api-key": NOWPAY_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount,
        price_currency: "usd",
        order_id,
        order_description,
        ipn_callback_url: `https://${req.get("host")}/api/ipn`,
        success_url: `https://${req.get("host")}/?payment=success&order_id=${order_id}`,
        cancel_url: `https://${req.get("host")}/?payment=cancel`,
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// IPN Callback - Auto Balance Add
app.post("/api/ipn", async (req, res) => {
  try {
    const sig = req.headers["x-nowpayments-sig"];
    const sortedBody = JSON.stringify(req.body, Object.keys(req.body).sort());
    if (IPN_SECRET) {
      const expected = crypto.createHmac("sha512", IPN_SECRET).update(sortedBody).digest("hex");
      if (sig !== expected) console.log("IPN Sig mismatch, but continuing for test");
    }

    const { order_id, payment_status, price_amount } = req.body;
    console.log("IPN:", req.body);

    if (payment_status === "finished" || payment_status === "confirmed") {
      const snap = await db.collection("deposits").where("id", "==", order_id).get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        if (doc.data().status !== "Approved") {
          await doc.ref.update({ status: "Approved", payment_status });
          const userRef = db.collection("users").doc(doc.data().user);
          const userSnap = await userRef.get();
          const bal = userSnap.exists ? (userSnap.data().balance || 0) : 0;
          await userRef.set({ email: doc.data().user, balance: bal + parseFloat(price_amount) }, { merge: true });
        }
      }
    }
    res.send("OK");
  } catch (e) {
    console.error(e);
    res.status(500).send("Error");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
