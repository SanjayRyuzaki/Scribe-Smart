const express = require('express');
  const path = require('path');
  const bodyParser = require('body-parser');

  const record = require('node-record-lpcm16');
  const speech = require('@google-cloud/speech');
  require('dotenv').config();


  const client = new speech.SpeechClient();

  const diarizationConfig = {
    enableSpeakerDiarization: true,
    minSpeakerCount: 2,
    maxSpeakerCount: 4,
  };

  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'en-US',
      diarizationConfig: diarizationConfig,
      enableAutomaticPunctuation : true,
    },
    interimResults: false,
  };



  const app = express();
  const port = 3000;

  const users = [
      { username: 'user1', password: 'password1' },
      { username: 'user2', password: 'password2' }
    ];
    

  // Define the directory where your static files (like HTML, CSS, images) reside
  const publicDirectoryPath = path.join(__dirname, 'public');

  // Serve static files from the 'public' directory
  app.use(express.static(publicDirectoryPath));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  // Define your endpoint to serve the HTML file
  app.get('/', (req, res) => {
    res.sendFile(path.join(publicDirectoryPath, 'login.html'));
  });

  app.post('/authenticate',(req,res)=>{
      const { username, password } = req.body;

      // Find user in the database
      const user = users.find(user => user.username === username && user.password === password);
    
      // Check if user exists and credentials match
      if (user) {
        // Authentication successful
        res.sendFile(path.join(publicDirectoryPath, 'upload.html'));
      } else {
        // Authentication failed
        res.status(401).json({ message: 'Invalid username or password' });
      }
  });


  // Start the server
  app.listen(port, () => {
    console.log(`Server is up on port ${port}`);
  });

  var recording;

  app.post('/starttrans', (req, res) => {
    console.log("recv start")
    
    // Create a new recording object each time you start a new recording
    recording = record.record();
    let shouldStopTranscription = false; // Flag to control transcription

    var recognizeStream = client
      .streamingRecognize(request)
      .on('error', (err) => {
        console.error('Error in transcription:', err);
        recording.stop();
        res.end();
      })
      .on('data', async (data) => {
        if (data.results[0] && data.results[0].alternatives[0]) {
          const text = data.results[0].alternatives[0].transcript;
          console.log(`Transcription: ${text}`);
    
          if (text.toLowerCase().includes('stop over finish')) {
            console.log('Stop keyword detected, ending transcription for current question');
            shouldStopTranscription = true; // Set flag to stop transcription
            recording = null; // Reset the stream
            recognizeStream.destroy();
            res.end();
          }
    
          if (!shouldStopTranscription) {
            res.write(text); // Write to response if shouldStopTranscription is false
          }
        } else {
          console.log(`\n\nReached transcription time limit, press Ctrl+C\n`);
        }
      });
    

    recording.stream().pipe(recognizeStream);
});

app.post('/stoptrans', (req, res) => {
  if (recording) {
    recording.stop();
    console.log("stopped");
    res.end(); // End the response
  }
});
