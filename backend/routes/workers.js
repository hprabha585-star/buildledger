const router  = require('express').Router();
const multer  = require('multer');
const { Worker, Attendance } = require('../models');
const auth    = require('../middleware/auth');

// Store photos as base64 in DB (no disk needed, works anywhere)
const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB

router.use(auth);

// GET all workers
router.get('/', async (req, res) => {
  try {
    // Exclude heavy photo field in list view for speed
    const workers = await Worker.find({ contractorId: req.user.id })
      .select('-photo')
      .sort({ createdAt: -1 });
    res.json(workers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single worker (with photo)
router.get('/:id', async (req, res) => {
  try {
    const worker = await Worker.findOne({ _id: req.params.id, contractorId: req.user.id });
    if (!worker) return res.status(404).json({ error: 'Not found' });
    res.json(worker);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CREATE worker (multipart for photo)
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { name, mobile, whatsapp, skill, dailyWage, address, joiningDate, idProof } = req.body;
    if (!name || !skill || !dailyWage) return res.status(400).json({ error: 'Name, skill, and daily wage required' });

    let photoData = '';
    if (req.file) {
      const mime = req.file.mimetype;
      photoData = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
    } else if (req.body.photo) {
      photoData = req.body.photo; // base64 from camera capture
    }

    const worker = await Worker.create({
      contractorId: req.user.id,
      name, photo: photoData,
      mobile: mobile || '', whatsapp: whatsapp || '',
      skill, dailyWage: Number(dailyWage),
      address: address || '', joiningDate: joiningDate || '',
      idProof: idProof || '',
    });
    res.status(201).json({ ...worker.toObject(), photo: photoData ? '(saved)' : '' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE worker
router.put('/:id', upload.single('photo'), async (req, res) => {
  try {
    const { name, mobile, whatsapp, skill, dailyWage, address, status, idProof } = req.body;
    const update = { name, mobile, whatsapp, skill, dailyWage: Number(dailyWage), address, status, idProof };

    if (req.file) {
      update.photo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    } else if (req.body.photo && req.body.photo.startsWith('data:')) {
      update.photo = req.body.photo;
    }

    const worker = await Worker.findOneAndUpdate(
      { _id: req.params.id, contractorId: req.user.id },
      update, { new: true }
    );
    res.json(worker);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE worker
router.delete('/:id', async (req, res) => {
  try {
    await Worker.findOneAndDelete({ _id: req.params.id, contractorId: req.user.id });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET worker photo only
router.get('/:id/photo', async (req, res) => {
  try {
    const worker = await Worker.findOne({ _id: req.params.id, contractorId: req.user.id }).select('photo');
    res.json({ photo: worker?.photo || '' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET wage summary for a worker
router.get('/:id/wage-summary', async (req, res) => {
  try {
    const { startDate, endDate, siteId } = req.query;
    const worker = await Worker.findOne({ _id: req.params.id, contractorId: req.user.id }).select('-photo');
    if (!worker) return res.status(404).json({ error: 'Not found' });

    const query = { workerId: req.params.id };
    if (siteId)    query.siteId = siteId;
    if (startDate) query.date   = { $gte: startDate };
    if (endDate)   query.date   = { ...query.date, $lte: endDate };

    const records = await Attendance.find(query).populate('siteId', 'name');
    let totalDays = 0;
    records.forEach(r => {
      if (r.status === 'present') totalDays += 1;
      else if (r.status === 'half') totalDays += 0.5;
    });

    res.json({ worker, totalDays, totalWage: totalDays * worker.dailyWage, records });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
