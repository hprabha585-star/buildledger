const router = require('express').Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const { Worker, Attendance } = require('../models');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
router.use(auth);

const FIELDS = ['name', 'gender', 'mobile', 'whatsapp', 'skill', 'dailyWage', 'address', 'joiningDate', 'idProof', 'status'];
const pick = (body) => {
  const out = {};
  FIELDS.forEach((f) => { if (body[f] !== undefined) out[f] = body[f]; });
  if (out.dailyWage !== undefined) out.dailyWage = Number(out.dailyWage) || 0;
  return out;
};

// List workers — exclude photo (large base64) for fast list rendering
router.get('/', async (req, res) => {
  try {
    const workers = await Worker.find({ contractorId: req.user.id }).select('-photo').sort({ createdAt: -1 });
    res.json(workers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Single worker — includes photo (used by worker detail page)
router.get('/:id', async (req, res) => {
  try {
    const w = await Worker.findOne({ _id: req.params.id, contractorId: req.user.id });
    if (!w) return res.status(404).json({ error: 'Worker not found' });
    res.json(w);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lazy-load just the photo (used by list views)
router.get('/:id/photo', async (req, res) => {
  try {
    const w = await Worker.findOne({ _id: req.params.id, contractorId: req.user.id }).select('photo');
    if (!w) return res.status(404).json({ error: 'Worker not found' });
    res.json({ photo: w.photo || '' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', upload.none(), async (req, res) => {
  try {
    const data = pick(req.body);
    if (!data.name || !data.skill || data.dailyWage === undefined) {
      return res.status(400).json({ error: 'Name, skill and daily wage are required' });
    }
    if (req.body.photo && req.body.photo.startsWith('data:')) data.photo = req.body.photo;
    const w = await Worker.create({ ...data, contractorId: req.user.id });
    res.json(w);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', upload.none(), async (req, res) => {
  try {
    const data = pick(req.body);
    if (req.body.photo && req.body.photo.startsWith('data:')) data.photo = req.body.photo;
    const w = await Worker.findOneAndUpdate(
      { _id: req.params.id, contractorId: req.user.id }, data, { new: true }
    );
    if (!w) return res.status(404).json({ error: 'Worker not found' });
    res.json(w);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const w = await Worker.findOneAndDelete({ _id: req.params.id, contractorId: req.user.id });
    if (!w) return res.status(404).json({ error: 'Worker not found' });
    await Attendance.deleteMany({ workerId: req.params.id, contractorId: req.user.id });
    res.json({ message: 'Worker deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Wage summary for one worker over a date range
router.get('/:id/wage-summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const worker = await Worker.findOne({ _id: req.params.id, contractorId: req.user.id });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    const q = { workerId: req.params.id, contractorId: req.user.id };
    if (startDate && endDate) q.date = { $gte: startDate, $lte: endDate };
    const records = await Attendance.find(q).populate('siteId', 'name').sort({ date: 1 });
    let totalDays = 0, totalWage = 0;
    records.forEach((r) => {
      const days = r.status === 'present' ? 1 : r.status === 'half' ? 0.5 : 0;
      totalDays += days;
      totalWage += days * worker.dailyWage;
    });
    res.json({ totalDays, totalWage, records });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
