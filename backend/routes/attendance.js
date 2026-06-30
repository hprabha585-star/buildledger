const router = require('express').Router();
const auth = require('../middleware/auth');
const { Attendance, Worker } = require('../models');

router.use(auth);

router.get('/stats', async (req, res) => {
  try {
    const count = await Attendance.countDocuments({ contractorId: req.user.id });
    const oldestDoc = await Attendance.findOne({ contractorId: req.user.id }).sort({ date: 1 }).select('date');
    res.json({ count, oldest: oldestDoc ? oldestDoc.date : null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-date/:date', async (req, res) => {
  try {
    const recs = await Attendance.find({ contractorId: req.user.id, date: req.params.date })
      .populate('workerId', 'name skill dailyWage')
      .populate('siteId', 'name');
    res.json(recs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Upsert attendance for a worker on a date
router.post('/mark', async (req, res) => {
  try {
    const { workerId, date, status, siteId } = req.body;
    if (!workerId || !date || !status) return res.status(400).json({ error: 'workerId, date and status are required' });
    const worker = await Worker.findOne({ _id: workerId, contractorId: req.user.id });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const expireAt = new Date(); expireAt.setDate(expireAt.getDate() + 62);
    const rec = await Attendance.findOneAndUpdate(
      { contractorId: req.user.id, workerId, date },
      { status, siteId: siteId || null, $setOnInsert: { wagePaid: false }, expireAt },
      { new: true, upsert: true }
    ).populate('workerId', 'name skill dailyWage').populate('siteId', 'name');
    res.json(rec);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/wage-paid', async (req, res) => {
  try {
    const { wagePaid } = req.body;
    const rec = await Attendance.findOneAndUpdate(
      { _id: req.params.id, contractorId: req.user.id },
      { wagePaid: !!wagePaid },
      { new: true }
    ).populate('workerId', 'name skill dailyWage').populate('siteId', 'name');
    if (!rec) return res.status(404).json({ error: 'Attendance record not found' });
    res.json(rec);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Per-worker wage summary across all workers for a date range
router.get('/wage-summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const q = { contractorId: req.user.id };
    if (startDate && endDate) q.date = { $gte: startDate, $lte: endDate };
    const recs = await Attendance.find(q).populate('workerId', 'name skill dailyWage');
    const map = {};
    recs.forEach((r) => {
      if (!r.workerId) return;
      const id = String(r.workerId._id);
      if (!map[id]) map[id] = { worker: r.workerId, present: 0, half: 0, totalDays: 0, earnedWage: 0, paidWage: 0, unpaidWage: 0 };
      const days = r.status === 'present' ? 1 : r.status === 'half' ? 0.5 : 0;
      if (r.status === 'present') map[id].present += 1;
      if (r.status === 'half') map[id].half += 1;
      map[id].totalDays += days;
      const wage = days * (r.workerId.dailyWage || 0);
      map[id].earnedWage += wage;
      if (r.wagePaid) map[id].paidWage += wage; else map[id].unpaidWage += wage;
    });
    res.json(Object.values(map));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/delete-all', async (req, res) => {
  try {
    const result = await Attendance.deleteMany({ contractorId: req.user.id });
    res.json({ message: `Deleted ${result.deletedCount} attendance records` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
