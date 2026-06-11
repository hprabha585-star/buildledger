const router = require('express').Router();
const { Site, Payment, Expense, Owner } = require('../models');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const sites = await Site.find({ contractorId: req.user.id })
      .populate('ownerId', 'name mobile whatsapp')
      .sort({ createdAt: -1 });

    const enriched = await Promise.all(sites.map(async s => {
      const payments = await Payment.find({ siteId: s._id });
      const totalPaid = payments.reduce((t, p) => t + p.amount, 0);
      return { ...s.toObject(), totalPaid, balance: (s.contractAmount || 0) - totalPaid };
    }));
    res.json(enriched);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

router.get('/:id', async (req, res) => {
  try {
    const site = await Site.findOne({ _id: req.params.id, contractorId: req.user.id })
      .populate('ownerId', 'name mobile whatsapp email address');
    if (!site) return res.status(404).json({ error: 'Not found' });

    const [payments, expenses] = await Promise.all([
      Payment.find({ siteId: req.params.id }).sort({ date: -1 }),
      Expense.find({ siteId: req.params.id }).populate('workerId', 'name').sort({ date: -1 }),
    ]);

    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

    res.json({
      ...site.toObject(), 
      payments, 
      expenses,
      financials: {
        contractAmount: site.contractAmount,
        totalPaid, 
        balance: site.contractAmount - totalPaid,
        totalExpense, 
        profit: totalPaid - totalExpense,
      }
    });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, location, ownerId, contractAmount, startDate, expectedEndDate, scope, status } = req.body;
    if (!name || !location) {
      return res.status(400).json({ error: 'Name and location required' });
    }
    const site = await Site.create({
      contractorId: req.user.id, 
      name, 
      location,
      ownerId: ownerId || null, 
      contractAmount: Number(contractAmount) || 0,
      startDate: startDate || '', 
      expectedEndDate: expectedEndDate || '',
      scope: scope || '', 
      status: status || 'active',
    });
    res.status(201).json(site);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, location, ownerId, contractAmount, startDate, expectedEndDate, scope, status } = req.body;
    const site = await Site.findOneAndUpdate(
      { _id: req.params.id, contractorId: req.user.id },
      { name, location, ownerId: ownerId || null, contractAmount: Number(contractAmount), startDate, expectedEndDate, scope, status },
      { new: true }
    ).populate('ownerId', 'name mobile');
    res.json(site);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Site.findOneAndDelete({ _id: req.params.id, contractorId: req.user.id });
    res.json({ message: 'Deleted' });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

module.exports = router;
