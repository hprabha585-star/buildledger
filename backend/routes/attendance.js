const router = require('express').Router();
const { Attendance, Worker, Site } = require('../models');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { workerId, date, startDate, endDate, siteId, unpaidOnly } = req.query;
    const query = { contractorId: req.user.id };
    if (workerId) query.workerId = workerId;
    if (siteId) query.siteId = siteId;
    if (date) query.date = date;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    if (unpaidOnly === 'true') query.wagePaid = false;

    const records = await Attendance.find(query)
      .populate('workerId', 'name skill dailyWage mobile whatsapp')
      .populate('siteId', 'name location')
      .sort({ date: -1 });
    res.json(records);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

router.post('/mark', async (req, res) => {
  try {
    const { workerId, date, status, siteId, note } = req.body;
    if (!workerId || !date || !status) {
      return res.status(400).json({ error: 'workerId, date, status required' });
    }

    const expireAt = new Date(date + 'T00:00:00');
    expireAt.setDate(expireAt.getDate() + 62);

    const record = await Attendance.findOneAndUpdate(
      { workerId, date, contractorId: req.user.id },
      { $set: {
          status,
          siteId: siteId || null,
          note: note || '',
          expireAt,
          contractorId: req.user.id,
        }
      },
      { upsert: true, new: true }
    ).populate('workerId', 'name skill dailyWage')
     .populate('siteId', 'name');

    res.json(record);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

router.patch('/:id/wage-paid', async (req, res) => {
  try {
    const { wagePaid } = req.body;
    const record = await Attendance.findOneAndUpdate(
      { _id: req.params.id, contractorId: req.user.id },
      { $set: { wagePaid: Boolean(wagePaid) } },
      { new: true }
    ).populate('workerId', 'name skill dailyWage')
     .populate('siteId', 'name');
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

router.patch('/bulk-wage-paid', async (req, res) => {
  try {
    const { ids, wagePaid } = req.body;
    if (!ids?.length) return res.status(400).json({ error: 'ids array required' });
    await Attendance.updateMany(
      { _id: { $in: ids }, contractorId: req.user.id },
      { $set: { wagePaid: Boolean(wagePaid) } }
    );
    res.json({ message: `Updated ${ids.length} records` });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

router.get('/wage-summary', async (req, res) => {
  try {
    const { startDate, endDate, siteId } = req.query;
    const query = { contractorId: req.user.id };
    if (siteId) query.siteId = siteId;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const [records, workers] = await Promise.all([
      Attendance.find(query),
      Worker.find({ contractorId: req.user.id }).select('-photo'),
    ]);

    const workerMap = Object.fromEntries(workers.map(w => [w._id.toString(), w]));
    const summary = {};

    for (const r of records) {
      const wid = r.workerId.toString();
      if (!summary[wid]) {
        summary[wid] = {
          worker: workerMap[wid],
          present: 0, half: 0, absent: 0,
          totalDays: 0, earnedWage: 0,
          paidDays: 0, paidWage: 0,
          unpaidDays: 0, unpaidWage: 0,
        };
      }
      const s = summary[wid];
      const wage = workerMap[wid]?.dailyWage || 0;

      if (r.status === 'present') { 
        s.present++; 
        s.totalDays += 1; 
        s.earnedWage += wage; 
        if (r.wagePaid) { 
          s.paidDays += 1; 
          s.paidWage += wage; 
        } else { 
          s.unpaidDays += 1; 
          s.unpaidWage += wage; 
        }
      } else if (r.status === 'half') { 
        s.half++; 
        s.totalDays += 0.5; 
        s.earnedWage += wage / 2; 
        if (r.wagePaid) { 
          s.paidDays += 0.5; 
          s.paidWage += wage / 2; 
        } else { 
          s.unpaidDays += 0.5; 
          s.unpaidWage += wage / 2; 
        }
      } else { 
        s.absent++; 
      }
    }

    res.json(Object.values(summary));
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

router.get('/by-date/:date', async (req, res) => {
  try {
    const records = await Attendance.find({ date: req.params.date, contractorId: req.user.id })
      .populate('workerId', 'name skill dailyWage mobile whatsapp')
      .populate('siteId', 'name');
    res.json(records);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [count, oldest, newest] = await Promise.all([
      Attendance.countDocuments({ contractorId: req.user.id }),
      Attendance.findOne({ contractorId: req.user.id }).sort({ date: 1 }).select('date expireAt'),
      Attendance.findOne({ contractorId: req.user.id }).sort({ date: -1 }).select('date expireAt'),
    ]);
    res.json({ count, oldest: oldest?.date, newest: newest?.date, autoDeleteAfterDays: 62 });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

router.delete('/delete-all', async (req, res) => {
  try {
    const result = await Attendance.deleteMany({ contractorId: req.user.id });
    res.json({ message: `Deleted ${result.deletedCount} records` });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

module.exports = router;
