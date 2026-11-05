const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || "/Rczecy1IsRbDWiBCun27es7v8XOS50N";
const API_KEY = process.env.NOWPAYMENTS_API_KEY || "QCWYJDM-26JM2FM-NT9KYQT-WK27HVQ";

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', ipn: '/api/ipn ready' });
});

app.get('/api/ipn', (req, res) => {
  res.status(200).send('IPN webhook endpoint is active - Ready to receive POST from NowPayments. IPN Secret: /Rcz...S50N');
});

app.post('/api/ipn', (req, res) => {
  try {
    const signature = req.headers['x-nowpayments-sig'];
    const payload = req.body;
    console.log('IPN Received:', JSON.stringify(payload));
    console.log('Signature:', signature);
    
    const { payment_status, order_id, price_amount, invoice_id } = payload;
    console.log(`Payment ${order_id} status: ${payment_status}, amount: ${price_amount}`);

    if (payment_status === 'finished' || payment_status === 'confirmed') {
      console.log(`✅ CONFIRMED: Order ${order_id}, Amount ${price_amount}`);
    }
    res.status(200).json({ message: 'IPN received', status: 'ok' });
  } catch (err) {
    console.error('IPN error:', err);
    res.status(200).json({ message: 'IPN error but acknowledged' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Webhook: https://vaultproviderapk.onrender.com/api/ipn`);
});
