const { mongoose } = require('../db/database');
const { Schema } = mongoose;

// ── USER ──────────────────────────────────────────────────────────────────────
const UserSchema = new Schema({
  name:        { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true },
  companyName: { type: String, default: '' },
}, { timestamps: true });

// ── WORKER ────────────────────────────────────────────────────────────────────
const WorkerSchema = new Schema({
  contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name:         { type: String, required: true, trim: true },
  photo:        { type: String, default: '' },
  mobile:       { type: String, default: '' },
  whatsapp:     { type: String, default: '' },
  skill:        { type: String, required: true },
  dailyWage:    { type: Number, required: true, min: 0 },
  address:      { type: String, default: '' },
  joiningDate:  { type: String, default: '' },
  idProof:      { type: String, default: '' },
  status:       { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

// ── OWNER ─────────────────────────────────────────────────────────────────────
const OwnerSchema = new Schema({
  contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name:         { type: String, required: true, trim: true },
  mobile:       { type: String, required: true },
  whatsapp:     { type: String, default: '' },
  email:        { type: String, default: '' },
  address:      { type: String, default: '' },
  notes:        { type: String, default: '' },
}, { timestamps: true });

// ── SITE ──────────────────────────────────────────────────────────────────────
const SiteSchema = new Schema({
  contractorId:    { type: Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
  ownerId:         { type: Schema.Types.ObjectId, ref: 'Owner', default: null },
  name:            { type: String, required: true, trim: true },
  location:        { type: String, required: true },
  contractAmount:  { type: Number, default: 0 },
  startDate:       { type: String, default: '' },
  expectedEndDate: { type: String, default: '' },
  scope:           { type: String, default: '' },
  status:          { type: String, enum: ['active', 'completed', 'on-hold', 'cancelled'], default: 'active' },
}, { timestamps: true });

// ── ATTENDANCE ────────────────────────────────────────────────────────────────
// siteId is OPTIONAL — worker may not be assigned to a specific site that day
// wagePaid: whether the contractor has paid this worker for this day
// Auto-delete: TTL index removes records older than 62 days (≈2 months)
const AttendanceSchema = new Schema({
  contractorId: { type: Schema.Types.ObjectId, ref: 'User',   required: true, index: true },
  workerId:     { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
  siteId:       { type: Schema.Types.ObjectId, ref: 'Site',   default: null },   // optional
  date:         { type: String, required: true },   // 'YYYY-MM-DD'
  status:       { type: String, enum: ['present', 'absent', 'half'], default: 'absent' },
  wagePaid:     { type: Boolean, default: false },   // wage taken by worker or not
  note:         { type: String, default: '' },
  // TTL field — Mongo auto-deletes doc when expireAt is reached
  expireAt:     { type: Date, default: () => {
    const d = new Date();
    d.setDate(d.getDate() + 62); // 62 days ≈ 2 months
    return d;
  }},
}, { timestamps: true });

// Unique: one record per worker per date (site is optional, not part of unique key)
AttendanceSchema.index({ workerId: 1, date: 1 }, { unique: true });
// TTL index — MongoDB daemon deletes documents when expireAt < now
AttendanceSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

// ── PAYMENT ───────────────────────────────────────────────────────────────────
const PaymentSchema = new Schema({
  contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  siteId:       { type: Schema.Types.ObjectId, ref: 'Site', required: true },
  amount:       { type: Number, required: true, min: 0 },
  date:         { type: String, required: true },
  paymentMode:  { type: String, enum: ['cash', 'cheque', 'online', 'bank transfer'], default: 'cash' },
  milestone:    { type: String, default: '' },
  notes:        { type: String, default: '' },
}, { timestamps: true });

// ── EXPENSE ───────────────────────────────────────────────────────────────────
const ExpenseSchema = new Schema({
  contractorId: { type: Schema.Types.ObjectId, ref: 'User',   required: true, index: true },
  siteId:       { type: Schema.Types.ObjectId, ref: 'Site',   required: true },
  workerId:     { type: Schema.Types.ObjectId, ref: 'Worker', default: null },
  amount:       { type: Number, required: true, min: 0 },
  date:         { type: String, required: true },
  category:     { type: String, enum: ['labor', 'materials', 'equipment', 'transport', 'misc'], default: 'labor' },
  description:  { type: String, default: '' },
}, { timestamps: true });

module.exports = {
  User:       mongoose.model('User',       UserSchema),
  Worker:     mongoose.model('Worker',     WorkerSchema),
  Owner:      mongoose.model('Owner',      OwnerSchema),
  Site:       mongoose.model('Site',       SiteSchema),
  Attendance: mongoose.model('Attendance', AttendanceSchema),
  Payment:    mongoose.model('Payment',    PaymentSchema),
  Expense:    mongoose.model('Expense',    ExpenseSchema),
};
