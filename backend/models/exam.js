const mongoose = require('mongoose');
const examSchema = new mongoose.Schema(
  {
  title: {
    type: String,
    required: true
  },
  description: String,
  date: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  totalMarks: {
    type: Number,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user", 
    required: false // only for production
  },
  questions: [
    {
      questionText: { type: String, required: true },
      options: [String], 
      correctAnswer: String, 
      marks: Number
    }
  ],
  proctoringSettings: {
    enableCameraMonitoring: { type: Boolean, default: false },
    detectTabSwitching: { type: Boolean, default: false },
    enableFaceDetection: { type: Boolean, default: false },
    enableAutoSubmission: { type: Boolean, default: true },
    enablePause: { type: Boolean, default: false },
    randomizeQuestions: { type: Boolean, default: false },
    randomizeOptions: { type: Boolean, default: false },
    maxAllowedViolations: { type: Number, default: 3 }
  }
}
)
const examModel = mongoose.model("exam",examSchema);
module.exports=examModel;