import { useState } from 'react';
import { Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, RadioGroup, FormControlLabel, Radio, Box } from '@mui/material';

/** Razorpay-style mock checkout modal — swap with real Razorpay Checkout JS in production */
export default function MockCheckout({ orderId, amount, onDone, onClose, busy }: {
  orderId: string; amount: number; onDone: (method: string) => void; onClose: () => void; busy: boolean;
}): JSX.Element {
  const [method, setMethod] = useState('upi');
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <Box sx={{ bgcolor: '#0B3A75', color: '#fff', p: 2.5, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
        <Typography sx={{ opacity: 0.8 }}>Razorpay (Mock)</Typography>
        <Typography sx={{ fontSize: 26, fontWeight: 800 }}>₹{amount.toLocaleString('en-IN')}</Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>Order: {orderId}</Typography>
      </Box>
      <DialogContent>
        <RadioGroup value={method} onChange={(e) => setMethod(e.target.value)}>
          {[
            { v: 'upi', label: 'UPI / GPay / PhonePe', icon: '📱' },
            { v: 'card', label: 'Credit / Debit Card', icon: '💳' },
            { v: 'netbanking', label: 'Net Banking', icon: '🏦' },
            { v: 'wallet', label: 'Wallet', icon: '👛' },
          ].map((m) => (
            <FormControlLabel key={m.v} value={m.v} control={<Radio />} label={`${m.icon}  ${m.label}`} sx={{ my: 0.5 }} />
          ))}
        </RadioGroup>
        <Typography variant="caption" color="text.secondary">
          Simulated gateway — no real money moves. Wire your Razorpay keys for production.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button variant="contained" disabled={busy} onClick={() => onDone(method)}>Pay ₹{amount.toLocaleString('en-IN')} →</Button>
      </DialogActions>
    </Dialog>
  );
}

