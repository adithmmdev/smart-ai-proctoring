const mongoose = require("mongoose");

const proctoringLogSchema = new mongoose.Schema({
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "exam",
    required: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  snapshot: String, 
  flags: [
    {
      type: {
        type: String,
      },
      message: String,
    },
  ],
});

const ProctoringLog = mongoose.model("ProctoringLog", proctoringLogSchema);
module.exports = ProctoringLog;