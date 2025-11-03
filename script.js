function runSimulation() {
  const N = parseInt(document.getElementById("numFrames").value);
  const W = parseInt(document.getElementById("winSize").value);
  const T = parseInt(document.getElementById("timePerFrame").value);
  const animate = document.getElementById("animate").checked;

  const canvas = document.getElementById("timeline");
  const ctx = canvas.getContext("2d");
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Lanes
  const ySender = 100, yReceiver = 300;
  const unitWidth = 60;

  // Draw axes
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, ySender);
  ctx.lineTo(canvas.width - 20, ySender);
  ctx.moveTo(60, yReceiver);
  ctx.lineTo(canvas.width - 20, yReceiver);
  ctx.stroke();

  ctx.fillStyle = "#333";
  ctx.fillText("Sender", 10, ySender + 5);
  ctx.fillText("Receiver", 10, yReceiver + 5);

  let events = [];
  let time = 0;
  for (let i = 1; i <= N; i++) {
    let sendTime = time;
    let recvTime = sendTime + T;
    let ackSendTime = recvTime;
    let ackRecvTime = ackSendTime + T;

    events.push({
      frame: i,
      send: sendTime,
      recv: recvTime,
      ackSend: ackSendTime,
      ackRecv: ackRecvTime
    });
    time = ackRecvTime; // next frame starts after ACK received
  }

  // Draw events
  const drawFrame = (f) => {
    const x1 = 80 + f.send * unitWidth;
    const x2 = 80 + f.recv * unitWidth;
    const y1 = ySender, y2 = yReceiver;

    // Frame arrow
    ctx.strokeStyle = "#007acc";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    drawArrowHead(ctx, x2, y2, Math.PI / 4);
    ctx.fillText("Frame " + f.frame, x1 + 5, y1 - 10);

    // ACK arrow
    const xa1 = 80 + f.ackSend * unitWidth;
    const xa2 = 80 + f.ackRecv * unitWidth;
    ctx.strokeStyle = "#28a745";
    ctx.beginPath();
    ctx.moveTo(xa1, y2);
    ctx.lineTo(xa2, y1);
    ctx.stroke();
    drawArrowHead(ctx, xa2, y1, -Math.PI / 4);
    ctx.fillText("ACK " + f.frame, xa1 + 5, y2 + 15);
  };

  if (animate) {
    let i = 0;
    const interval = setInterval(() => {
      drawFrame(events[i]);
      i++;
      if (i >= events.length) clearInterval(interval);
    }, 800);
  } else {
    for (const f of events) drawFrame(f);
  }

  // Statistics
  document.getElementById("framesTx").innerText = N;
  document.getElementById("acksTx").innerText = N;
  document.getElementById("totalTime").innerText = time + " time units";
  document.getElementById("efficiency").innerText = "100% (Ideal Channel)";
}

function drawArrowHead(ctx, x, y, angle) {
  const len = 8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - len * Math.cos(angle - 0.3), y - len * Math.sin(angle - 0.3));
  ctx.moveTo(x, y);
  ctx.lineTo(x - len * Math.cos(angle + 0.3), y - len * Math.sin(angle + 0.3));
  ctx.stroke();
}
