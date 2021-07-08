const init = async () => {
  try {
    const devInfos = await navigator.mediaDevices.enumerateDevices();
    const option = document.createElement("option");
    option.value = "no-input";
    option.textContent = "(No input)";
    audioInSelect.appendChild(option);
    let index = 0;
    for (const info of devInfos) {
      if (info.kind !== "audioinput") {
        continue;
      }
      console.log(info);
      const option = document.createElement("option");
      option.value = info.deviceId;
      option.textContent = info.label || "Audio in " + (++index);
      audioInSelect.appendChild(option);
    }
  } catch (e) {
    console.log(e);
    alert.textContent = e.message;
    //modalError.modal('show');
  }
};
init();

audioInLevel.disabled = false;

audioInLevel.value = 0;


timeLimit.disabled = false;

timeLimit.value = 3;

encoding.disabled = false;

encoding.checked = true;

encodingProcess.disabled = false;

encodingProcess.checked = true;

reportInterval.disabled = false;

reportInterval.value = 1;

bufferSize.disabled = false;

const connectAudio = (audioContext) => {
  const testTone = () => {
    const osc = audioContext.createOscillator();
    const lfo = audioContext.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 2;
    const oscMod = audioContext.createGain();
    osc.connect(oscMod);
    lfo.connect(oscMod.gain);
    const output = audioContext.createGain();
    output.gain.value = 0.5;
    oscMod.connect(output);
    osc.start();
    lfo.start();
    return output;
  };
  
  const testToneLevel = audioContext.createGain();

  testToneLevel.gain.value = 0;

  testTone().connect(testToneLevel);

  audioGain = audioContext.createGain();
  audioGain.gain.value = 0;
  mixer = audioContext.createGain();

  testToneLevel.connect(mixer);

  inTestToneLevel.disabled = false;
  inTestToneLevel.value = 0;
    inTestToneLevel.onchange = function() {
    const level = inTestToneLevel.value / 100;
    testToneLevel.gain.value = level * level;
  };

  audioIn = null;
  audioGain.connect(mixer);
  mixer.connect(audioContext.destination);

  audioRecorder = new WebAudioRecorder(mixer, {
    workerDir: "lib/",
    onEncoderLoading: function(recorder, encoding) {
      console.log(recorder, encoding);
      document.querySelector("#modalLoading .modal-title").innerHTML = "Loading " + (encoding.toUpperCase()) + " encoder ...";
      //modalLoading.modal('show');
    }
  });

  audioRecorder.onEncoderLoaded = function() {
    modalLoading.style.display = "hidden";
  };
  audioRecorder.onTimeout = function(recorder) {
    stopRecording(true);
  };
  
  audioRecorder.onEncodingProgress = function(recorder, progress) {
    setProgress(progress);
  };
  
  audioRecorder.onComplete = function(recorder, blob) {
    if (recorder.options.encodeAfterRecord) {
      modalProgress.modal('hide');
    }
    saveRecording(blob, recorder.encoding);
  };
  
  audioRecorder.onError = function(recorder, message) {
    onError(message);
  };

  const minSecStr = function(n) {
    return (n < 10 ? "0" : "") + n;
  };
  
  updateDateTime = function() {
    dateTime.textContent = new Date().toString();
    const sec = audioRecorder.recordingTime() | 0;
    timeDisplay.textContent = (minSecStr(sec / 60 | 0)) + ":" + (minSecStr(sec % 60));
  };
  
  window.setInterval(updateDateTime, 200);
  

  audioInLevel.onchange = function() {
    const level = audioInLevel.value / 100;
    audioGain.gain.value = level * level;
  };


  onGotAudioIn = function(stream) {
    console.log("stream", stream)
    if (audioIn != null) {
      audioIn.disconnect();
    }
    audioIn = audioContext.createMediaStreamSource(stream);
    audioIn.connect(audioGain);
    return audioInLevel.classList.remove('hidden');
  };

  onChangeAudioIn = async () => {
    const deviceId = audioInSelect.value;
    if (deviceId === 'no-input') {
      if (audioIn != null) {
        audioIn.disconnect();
      }
      audioIn = null;
      audioInLevel.classList.add('hidden');
    } else {
      if (deviceId === 'default-audio-input') {
        deviceId = void 0;
      }
      const constraint = {
        audio: {
          deviceId: deviceId ? {
            exact: deviceId
          } : void 0,
          echoCancellation: echoCancellation.checked
        }
      };
      console.log(constraint);
      try {
        const audio = await navigator.mediaDevices.getUserMedia(constraint);
        onGotAudioIn(audio);
      } catch (e) {
        console.log(e);
      }
    }
  };
  audioInSelect.onchange = onChangeAudioIn;
  echoCancellation.onchange = onChangeAudioIn;
  onChangeAudioIn();

  // buf
  defaultBufSz = (function() {
    const processor = audioContext.createScriptProcessor(void 0, 2, 2);
    return processor.bufferSize;
  })();
  
  BUFFER_SIZE = [256, 512, 1024, 2048, 4096, 8192, 16384];
  
  iDefBufSz = BUFFER_SIZE.indexOf(defaultBufSz);
  
  updateBufferSizeText = function() {
    const iBufSz = bufferSize.value;
    const text = "" + BUFFER_SIZE[iBufSz];
    if (iBufSz === iDefBufSz) {
      text += ' (browser default)';
    }
    document.querySelector('#buffer-size-text').textContent = text;
  };
  
  bufferSize.onchange = updateBufferSizeText;
  
  bufferSize.value = iDefBufSz;
  
  updateBufferSizeText();
};

const plural = function(n) {
  if (n > 1) {
    return 's';
  } else {
    return '';
  }
};

timeLimit.onchange = function() {
  const min = timeLimit.value;
  document.querySelector('#time-limit-text').innerHTML = min + " minute" + plural(min);
};

OGG_QUALITY = [-0.1, 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

OGG_KBPS = [45, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 500];

MP3_BIT_RATE = [64, 80, 96, 112, 128, 160, 192, 224, 256, 320];

ENCODING_OPTION = {
  wav: {
    label: '',
    hidden: true,
    max: 1,
    text: function(val) {
      return '';
    }
  },
  ogg: {
    label: 'Quality',
    hidden: false,
    max: OGG_QUALITY.length - 1,
    text: function(val) {
      return "" + (OGG_QUALITY[val].toFixed(1)) + " (~" + OGG_KBPS[val] + "kbps)";
    }
  },
  mp3: {
    label: 'Bit rate',
    hidden: false,
    max: MP3_BIT_RATE.length - 1,
    text: function(val) {
      return "" + MP3_BIT_RATE[val] + "kbps";
    }
  }
};

optionValue = {
  wav: null,
  ogg: 6,
  mp3: 5
};

encoding.onchange = function(event) {
  const enc = encoding.value;
  console.log(enc);
  audioRecorder.setEncoding(enc);
  const option = ENCODING_OPTION[enc];
  document.querySelector('#encoding-option-label').textContent = option.label;
  document.querySelector('#encoding-option-text').textContent = option.text(optionValue[enc]);
  encodingOption.classList.toggle('hidden');
  //, option.hidden).attr('max', option.max);
  encodingOption.value = optionValue[encoding];
};

encodingOption.onchange = function() {
  const encoding = audioRecorder.encoding;
  const option = ENCODING_OPTION[encoding];
  optionValue[encoding] = encodingOption[0].valueAsNumber;
  ('#encoding-option-text').html(option.text(optionValue[encoding]));
};

//encodingProcess = 'background';

encodingProcess.onclick = function(event) {
  encodingProcess = (event.target).attr('mode');
  const hidden = encodingProcess === 'background';
  ('#report-interval-label').toggleClass('hidden', hidden);
  reportInterval.toggleClass('hidden', hidden);
  ('#report-interval-text').toggleClass('hidden', hidden);
};

reportInterval.onchange = function() {
  const sec = reportInterval[0].valueAsNumber;
  ('#report-interval-text').html("" + sec + " second" + (plural(sec)));
};


saveRecording = function(blob, enc) {
  const time = new Date();
  const url = URL.createObjectURL(blob);
  const html = ("<p recording='" + url + "'>") + ("<audio controls src='" + url + "'></audio> ") + ("(" + enc + ") " + (time.toString()) + " ") + ("<a class='btn btn-default' href='" + url + "' download='recording." + enc + "'>") + "Save..." + "</a> " + ("<button class='btn btn-danger' recording='" + url + "'>Delete</button>");
  "</p>";
  recordingList.innerHTML += html;
  //prepend((html));
};

/*
recordingList.onclick = function(event) {
  const url = event.target.attr('recording');
  ("p[recording='" + url + "']").remove();
  URL.revokeObjectURL(url);
};
*/

progressComplete = false;

setProgress = function(progress) {
  const percent = "" + ((progress * 100).toFixed(1)) + "%";
  document.querySelector('#modalProgress .progress-bar').style = "width: " + percent + ";";
  document.querySelector("#modalProgress .text-center").textContent = percent;
  progressComplete = progress === 1;
};

let audioRecorder = null;
/*
modalProgress.on('hide.bs.modal', function() {
  if (!progressComplete) {
    audioRecorder.cancelEncoding();
  }
});
*/

disableControlsOnRecord = function(disabled) {
  audioInSelect.disabled = disabled;
  echoCancellation.disabled = disabled;
  timeLimit.disabled = disabled;
  encoding.disabled = disabled;
  encodingOption.disabled = disabled;
  encodingProcess.disabled = disabled;
  reportInterval.disabled = disabled;
  bufferSize.disabled = disabled;
};

startRecording = function() {
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

  const audioContext = new AudioContext();
  
  if (audioContext.createScriptProcessor == null) {
    audioContext.createScriptProcessor = audioContext.createJavaScriptNode;
  }
  
  connectAudio(audioContext);
  
  recording.classList.remove('hidden');
  record.textContent = 'STOP';
  cancel.classList.remove('hidden');
  disableControlsOnRecord(true);
  audioRecorder.setOptions({
    timeLimit: timeLimit.value * 60,
    encodeAfterRecord: encodingProcess === 'separate',
    progressInterval: reportInterval.value * 1000,
    ogg: {
      quality: OGG_QUALITY[optionValue.ogg]
    },
    mp3: {
      bitRate: MP3_BIT_RATE[optionValue.mp3]
    }
  });
  audioRecorder.startRecording();
  setProgress(0);
};

stopRecording = function(finish) {
  recording.classList.add('hidden');
  record.textContent = 'RECORD';
  cancel.classList.add('hidden');
  disableControlsOnRecord(false);
  if (finish) {
    audioRecorder.finishRecording();
    if (audioRecorder.options.encodeAfterRecord) {
      document.querySelector("#modalProgress .modal-title").textContent = "Encoding " + (audioRecorder.encoding.toUpperCase());
      modalProgress.style.display = "block"; // modal('show');
    }
  } else {
    audioRecorder.cancelRecording();
  }
};

record.onclick = function() {
  if (audioRecorder && audioRecorder.isRecording()) {
    stopRecording(true);
  } else {
    startRecording();
  }
};

cancel.onclick = function() {
  stopRecording(false);
};

