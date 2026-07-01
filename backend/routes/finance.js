const router = require('express').Router();
const auth = require('../middleware/auth');
const { Site, Payment, Expense, Worker, Attendance } = require('../models');

router.use(auth);

const TODAY = () => new Date().toISOString().split('T')[0];

router.get('/dashboard', async (req, res) => {
  try {
    const cid = req.user.id;
    const [sites, payments, expenses, workers, todayRecs, allUnpaidRecs] = await Promise.all([
      Site.find({ contractorId: cid }).populate('ownerId', 'name'),
      Payment.find({ contractorId: cid }).populate('siteId', 'name').sort({ date: -1, createdAt: -1 }),
      Expense.find({ contractorId: cid }).populate('siteId', 'name').sort({ date: -1, createdAt: -1 }),
      Worker.find({ contractorId: cid }).select('-photo'),
      Attendance.find({ contractorId: cid, date: TODAY() }),
      // All worked-but-unpaid records across all stored dates (up to 62-day TTL)
      Attendance.find({
        contractorId: cid,
        status: { $in: ['present', 'half'] },
        wagePaid: false,
      }).populate('workerId', 'name skill dailyWage photo').sort({ date: -1 }),
    ]);

    const paidBySite = {};
    payments.forEach((p) => { const k = String(p.siteId?._id || p.siteId); paidBySite[k] = (paidBySite[k] || 0) + p.amount; });

    const totalReceived = payments.reduce((s, p) => s + p.amount, 0);
    const totalContractValue = sites.reduce((s, x) => s + (x.contractAmount || 0), 0);
    const totalOutstanding = totalContractValue - totalReceived;
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = totalReceived - totalExpenses;
    const activeSites = sites.filter((s) => s.status === 'active').length;
    const presentToday = todayRecs.filter((r) => r.status === 'present' || r.status === 'half').length;
    const unpaidToday = allUnpaidRecs
      .filter((r) => r.workerId) // guard against deleted workers
      .map((r) => ({
        _id: r._id,
        date: r.date,
        status: r.status,
        wagePaid: r.wagePaid,
        worker: r.workerId,
        wage: r.status === 'present' ? r.workerId.dailyWage : r.workerId.dailyWage / 2,
      }));

    const sitesOut = sites.map((s) => {
      const received = paidBySite[String(s._id)] || 0;
      return { _id: s._id, name: s.name, contractAmount: s.contractAmount || 0, received, balance: (s.contractAmount || 0) - received, status: s.status };
    });

    res.json({
      totals: { totalReceived, totalContractValue, totalOutstanding, activeSites, netProfit, totalExpenses, workers: workers.length },
      todayAttendance: { present: presentToday },
      unpaidToday,
      recentPayments: payments.slice(0, 5),
      recentExpenses: expenses.slice(0, 5),
      sites: sitesOut,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PAYMENTS ──
router.get('/payments', async (req, res) => {
  try {
    const payments = await Payment.find({ contractorId: req.user.id }).populate('siteId', 'name').sort({ date: -1, createdAt: -1 });
    res.json(payments);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/payments', async (req, res) => {
  try {
    const { siteId, amount, date, paymentMode, milestone, notes } = req.body;
    if (!siteId || !amount || !date) return res.status(400).json({ error: 'siteId, amount and date are required' });
    const site = await Site.findOne({ _id: siteId, contractorId: req.user.id });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    const p = await Payment.create({ siteId, amount: Number(amount), date, paymentMode: paymentMode || 'cash', milestone, notes, contractorId: req.user.id });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/payments/:id', async (req, res) => {
  try {
    const p = await Payment.findOneAndDelete({ _id: req.params.id, contractorId: req.user.id });
    if (!p) return res.status(404).json({ error: 'Payment not found' });
    res.json({ message: 'Payment deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── EXPENSES ──
router.get('/expenses', async (req, res) => {
  try {
    const q = { contractorId: req.user.id };
    if (req.query.siteId) q.siteId = req.query.siteId;
    const expenses = await Expense.find(q).populate('workerId', 'name').sort({ date: -1, createdAt: -1 });
    res.json(expenses);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/expenses', async (req, res) => {
  try {
    const { siteId, amount, date, category, description, workerId } = req.body;
    if (!siteId || !amount || !date) return res.status(400).json({ error: 'siteId, amount and date are required' });
    const site = await Site.findOne({ _id: siteId, contractorId: req.user.id });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    const e = await Expense.create({
      siteId, amount: Number(amount), date, category: category || 'misc', description,
      workerId: workerId || null, contractorId: req.user.id,
    });
    res.json(e);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/expenses/:id', async (req, res) => {
  try {
    const e = await Expense.findOneAndDelete({ _id: req.params.id, contractorId: req.user.id });
    if (!e) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
