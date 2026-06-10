const router = require('express').Router();
const { Payment, Expense, Site, Worker, Attendance } = require('../models');
const auth   = require('../middleware/auth');

router.use(auth);

// ── PAYMENTS ──────────────────────────────────────────────────────────────────
router.get('/payments', async (req, res) => {
  try {
    const query = { contractorId: req.user.id };
    if (req.query.siteId) query.siteId = req.query.siteId;
    const payments = await Payment.find(query)
      .populate('siteId', 'name contractAmount ownerId')
      .sort({ date: -1 });
    res.json(payments);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/payments', async (req, res) => {
  try {
    const { siteId, amount, date, paymentMode, milestone, notes } = req.body;
    if (!siteId || !amount || !date) return res.status(400).json({ error: 'siteId, amount, date required' });
    const payment = await Payment.create({
      contractorId: req.user.id, siteId,
      amount: Number(amount), date, paymentMode: paymentMode || 'cash',
      milestone: milestone || '', notes: notes || '',
    });
    // Return with balance
    const allPayments = await Payment.find({ siteId, contractorId: req.user.id });
    const site        = await Site.findById(siteId).select('contractAmount name');
    const totalPaid   = allPayments.reduce((s, p) => s + p.amount, 0);
    res.status(201).json({ payment, totalPaid, balance: (site?.contractAmount || 0) - totalPaid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/payments/:id', async (req, res) => {
  try {
    await Payment.findOneAndDelete({ _id: req.params.id, contractorId: req.user.id });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── EXPENSES ──────────────────────────────────────────────────────────────────
router.get('/expenses', async (req, res) => {
  try {
    const query = { contractorId: req.user.id };
    if (req.query.siteId) query.siteId = req.query.siteId;
    const expenses = await Expense.find(query)
      .populate('siteId',   'name')
      .populate('workerId', 'name')
      .sort({ date: -1 });
    res.json(expenses);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/expenses', async (req, res) => {
  try {
    const { siteId, amount, date, category, description, workerId } = req.body;
    if (!siteId || !amount || !date) return res.status(400).json({ error: 'siteId, amount, date required' });
    const expense = await Expense.create({
      contractorId: req.user.id, siteId,
      amount: Number(amount), date, category: category || 'labor',
      description: description || '', workerId: workerId || null,
    });
    res.status(201).json(expense);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/expenses/:id', async (req, res) => {
  try {
    await Expense.findOneAndDelete({ _id: req.params.id, contractorId: req.user.id });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const cid   = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const [sites, workers, payments, expenses, todayAtt] = await Promise.all([
      Site.find({ contractorId: cid }),
      Worker.find({ contractorId: cid }).select('-photo'),
      Payment.find({ contractorId: cid }).populate('siteId', 'name').sort({ createdAt: -1 }),
      Expense.find({ contractorId: cid }).populate('siteId', 'name').sort({ createdAt: -1 }),
      Attendance.find({ contractorId: cid, date: today }),
    ]);

    const totalReceived = payments.reduce((s, p) => s + p.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalContract = sites.reduce((s, si) => s + (si.contractAmount || 0), 0);
    const todayPresent  = todayAtt.filter(a => a.status === 'present' || a.status === 'half').length;

    const paymentBySite = {};
    payments.forEach(p => {
      const sid = p.siteId?._id?.toString() || p.siteId?.toString();
      paymentBySite[sid] = (paymentBySite[sid] || 0) + p.amount;
    });

    res.json({
      totals: {
        sites: sites.length,
        activeSites:        sites.filter(s => s.status === 'active').length,
        workers:            workers.filter(w => w.status === 'active').length,
        totalContractValue: totalContract,
        totalReceived,
        totalOutstanding:   totalContract - totalReceived,
        totalExpenses,
        netProfit:          totalReceived - totalExpenses,
      },
      todayAttendance: { present: todayPresent, total: workers.filter(w => w.status === 'active').length },
      recentPayments:  payments.slice(0, 5),
      recentExpenses:  expenses.slice(0, 5),
      sites: sites.map(s => ({
        ...s.toObject(),
        received: paymentBySite[s._id.toString()] || 0,
        balance:  (s.contractAmount || 0) - (paymentBySite[s._id.toString()] || 0),
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
