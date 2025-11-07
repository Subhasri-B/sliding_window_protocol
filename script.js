// script.js - Stop-and-Wait simulator with automatic step-by-step arrow reveal (~1s each)
document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const numFramesEl = document.getElementById("numFrames");
  const winSizeEl = document.getElementById("winSize");
  const timePerFrameEl = document.getElementById("timePerFrame");
  const errorTypeEl = document.getElementById("errorType");
  const errorModeEl = document.getElementById("errorMode");
  const userFrameDiv = document.getElementById("userFrameDiv");
  const userAckDiv = document.getElementById("userAckDiv");
  const nthDiv = document.getElementById("nthDiv");
  const userFrameNoEl = document.getElementById("userFrameNo");
  const userAckNoEl = document.getElementById("userAckNo");
  const nthValueEl = document.getElementById("nthValue");
  const simulateBtn = document.getElementById("simulateBtn");
  const clearBtn = document.getElementById("clearBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const devBtn = document.getElementById("devBtn");
  const helpBtn = document.getElementById("helpBtn");

  const canvas = document.getElementById("timelineCanvas");
  const ctx = canvas.getContext("2d");

  // Stats DOM
  const statWin = document.getElementById("statWin");
  const statFrames = document.getElementById("statFrames");
  const statFramesPerUnit = document.getElementById("statFramesPerUnit");
  const statTimePerFrame = document.getElementById("statTimePerFrame");
  const statErrorType = document.getElementById("statErrorType");
  const statFramesLost = document.getElementById("statFramesLost");
  const statAcksLost = document.getElementById("statAcksLost");
  const statRetrans = document.getElementById("statRetrans");
  const statSuccess = document.getElementById("statSuccess");
    // ===== Developer Popup Functions =====
  function showDevelopedBy() {
    document.getElementById("devPopup").style.display = "flex";
  }

  function closePopup() {
    document.getElementById("devPopup").style.display = "none";
  }

  // Developed by & Help buttons
  devBtn.addEventListener("click", () => {
    alert(`Developed by:
Niranjan Kumar S – 24BCE1769
Subhasri Balachandiran – 24BCE1833
Ranse Roger J – 24BCE1531

Mentor: Dr. Swaminathan`);
  });

  helpBtn.addEventListener("click", () => {
    alert(`Instructions:
1) Set number of frames (N), window size W, and time per frame (units).
2) Choose error type and error mode (random / user-defined / every nth) if needed.
   - For user-defined, provide ONLY the relevant number (frame no. for frame errors/timeouts; ack no. for ack errors/timeouts).
   - For every nth, provide n.
3) Click Simulate. The timeline will animate automatically showing arrows one-by-one (≈1s per event).
4) Click Download to export the timeline + stats as a PNG.`);
  });

  // Enable/disable errorMode and show relevant inputs
  function updateInputsVisibility() {
    const errType = errorTypeEl.value;
    // reset
    errorModeEl.disabled = (errType === "none");
    userFrameDiv.classList.add("hidden");
    userAckDiv.classList.add("hidden");
    nthDiv.classList.add("hidden");

    if (errType === "none") return;

    const mode = errorModeEl.value;
    if (mode === "user") {
      // user defined: show only relevant input
      if (errType === "frame_lost" || errType === "frame_timeout") userFrameDiv.classList.remove("hidden");
      if (errType === "ack_lost" || errType === "ack_timeout") userAckDiv.classList.remove("hidden");
    } else if (mode === "nth") {
      nthDiv.classList.remove("hidden");
    }
  }

  errorTypeEl.addEventListener("change", updateInputsVisibility);
  errorModeEl.addEventListener("change", updateInputsVisibility);

  // helpers for drawing
  function drawArrowHead(x, y, angle) {
    const len = 8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * Math.cos(angle - 0.35), y - len * Math.sin(angle - 0.35));
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * Math.cos(angle + 0.35), y - len * Math.sin(angle + 0.35));
    ctx.stroke();
  }

  function drawAxes(senderX, receiverX) {
    ctx.font = "14px Segoe UI, Arial";
    ctx.fillStyle = "#333";
    ctx.fillText("Sender", senderX - 30, 22);
    ctx.fillText("Receiver", receiverX - 20, 22);

    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(senderX, 30);
    ctx.lineTo(senderX, canvas.height - 20);
    ctx.moveTo(receiverX, 30);
    ctx.lineTo(receiverX, canvas.height - 20);
    ctx.stroke();
  }

  // Main simulation (creates an event queue then animates one-by-one)
  simulateBtn.addEventListener("click", () => {
    // read inputs
    const N = parseInt(numFramesEl.value, 10) || 0;
    const W = parseInt(winSizeEl.value, 10) || 1;
    const T = parseInt(timePerFrameEl.value, 10) || 1;
    const errType = errorTypeEl.value;        // none, frame_lost, ack_lost, frame_timeout, ack_timeout
    const errMode = errorModeEl.value;        // none, random, user, nth
    const userFrameNo = parseInt(userFrameNoEl.value, 10) || -1;
    const userAckNo = parseInt(userAckNoEl.value, 10) || -1;
    const nthVal = parseInt(nthValueEl.value, 10) || 3;

    // reset canvas & stats
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const senderX = 200;
    const receiverX = canvas.width - 200;
    drawAxes(senderX, receiverX);

    // time mapping
    const marginTop = 40;
    const marginBottom = 40;
    const availHeight = canvas.height - marginTop - marginBottom;
    const unitHeight = Math.max(18, Math.floor(availHeight / Math.max(20, (2 * T) * N + 8)));

    // build event queue (each event is a function that draws next arrow/label)
    const events = [];
    // stats
    let framesLost = 0, acksLost = 0, retransmissions = 0, successCount = 0;

    let currentTime = 0; // measured in units; we'll advance at each main step

    // Helper to decide whether error occurs for frame/ack of i
    function checkErrorForFrame(i) {
      if (errType !== "frame_lost" && errType !== "frame_timeout") return { frameError: false, frameTimeout: false };
      if (errMode === "random") {
        const pick = Math.random();
        if (pick < 0.25) {
          return errType === "frame_lost" ? { frameError: true } : { frameTimeout: true };
        }
      } else if (errMode === "user") {
        if (i === userFrameNo) {
          return errType === "frame_lost" ? { frameError: true } : { frameTimeout: true };
        }
      } else if (errMode === "nth") {
        if (i % nthVal === 0) {
          return errType === "frame_lost" ? { frameError: true } : { frameTimeout: true };
        }
      }
      return { frameError: false, frameTimeout: false };
    }
    function checkErrorForAck(i) {
      if (errType !== "ack_lost" && errType !== "ack_timeout") return { ackError: false, ackTimeout: false };
      if (errMode === "random") {
        const pick = Math.random();
        if (pick < 0.25) {
          return errType === "ack_lost" ? { ackError: true } : { ackTimeout: true };
        }
      } else if (errMode === "user") {
        if (i === userAckNo) {
          return errType === "ack_lost" ? { ackError: true } : { ackTimeout: true };
        }
      } else if (errMode === "nth") {
        if (i % nthVal === 0) {
          return errType === "ack_lost" ? { ackError: true } : { ackTimeout: true };
        }
      }
      return { ackError: false, ackTimeout: false };
    }

    // For each frame we create a sequence of events (frame send, possibly lost/timeouts/resend, ack, possibly lost/resend)
    for (let i = 1; i <= N; i++) {
      const sendTime = currentTime;
      const recvTime = sendTime + T;
      const ackSendTime = recvTime;
      const ackRecvTime = ackSendTime + T;

      const fe = checkErrorForFrame(i);
      const ae = checkErrorForAck(i);

      // Event: draw frame arrow from sender -> receiver
      events.push(() => {
        const ySend = marginTop + sendTime * unitHeight;
        const yRecv = marginTop + recvTime * unitHeight;
        ctx.lineWidth = 2;
        if (fe.frameError || fe.frameTimeout) ctx.strokeStyle = "#e53935"; // red
        else ctx.strokeStyle = "#1e88e5"; // blue
        ctx.beginPath();
        ctx.moveTo(senderX, ySend);
        ctx.lineTo(receiverX, yRecv);
        ctx.stroke();
        drawArrowHead(receiverX, yRecv, Math.PI / 2);
        ctx.font = "13px Segoe UI, Arial";
        ctx.fillStyle = fe.frameError || fe.frameTimeout ? "#a80000" : "#222";
        ctx.fillText(`Frame ${i}`, senderX - 110, ySend + 4);
        if (fe.frameError) {
          ctx.fillText("Frame Lost!", receiverX + 8, yRecv + 4);
        } else if (fe.frameTimeout) {
          ctx.fillText("Frame Timeout!", receiverX + 8, yRecv + 4);
        }
      });

      // If frame lost/timeout => retransmit (single retransmission attempt that we make succeed)
      if (fe.frameError || fe.frameTimeout) {
        framesLost += fe.frameError ? 1 : 0;
        retransmissions += 1;
        const resendStart = ackRecvTime + T;
        const resendSendY = marginTop + resendStart * unitHeight;
        const resendRecvY = marginTop + (resendStart + T) * unitHeight;

        events.push(() => {
          ctx.strokeStyle = "#6a1b9a"; // purple
          ctx.beginPath();
          ctx.moveTo(senderX, resendSendY);
          ctx.lineTo(receiverX, resendRecvY);
          ctx.stroke();
          drawArrowHead(receiverX, resendRecvY, Math.PI / 2);
          ctx.fillStyle = "#6a1b9a";
          ctx.fillText(`Resend Frame ${i}`, senderX - 110, resendSendY + 4);
        });

        // schedule ack event for resend
        events.push(() => {
          const ackSendY = resendRecvY;
          const ackRecvY = marginTop + (resendStart + 2 * T) * unitHeight;
          if (errType === "ack_lost" || errType === "ack_timeout") {
            const aeResend = checkErrorForAck(i);
            if (aeResend.ackError) {
              acksLost += 1;
              retransmissions += 1;
              ctx.strokeStyle = "#ff9800";
              ctx.beginPath();
              ctx.moveTo(receiverX, ackSendY);
              ctx.lineTo(senderX, ackRecvY);
              ctx.stroke();
              drawArrowHead(senderX, ackRecvY, -Math.PI / 2);
              ctx.fillStyle = "#a66a00";
              ctx.fillText("ACK Lost!", senderX - 120, ackRecvY + 4);
              // sender resends once more visually
              const resend2Start = resendStart + 2 * T + 1;
              const resend2SendY = marginTop + resend2Start * unitHeight;
              const resend2RecvY = marginTop + (resend2Start + T) * unitHeight;
              ctx.strokeStyle = "#6a1b9a";
              ctx.beginPath();
              ctx.moveTo(senderX, resend2SendY);
              ctx.lineTo(receiverX, resend2RecvY);
              ctx.stroke();
              drawArrowHead(receiverX, resend2RecvY, Math.PI / 2);
              ctx.fillStyle = "#6a1b9a";
              ctx.fillText(`Final Resend ${i}`, senderX - 110, resend2SendY + 4);
              successCount += 1;
              return;
            } else if (aeResend.ackTimeout) {
              acksLost += 1;
              retransmissions += 1;
              ctx.strokeStyle = "#ff9800";
              ctx.beginPath();
              ctx.moveTo(receiverX, ackSendY);
              ctx.lineTo(senderX, ackRecvY);
              ctx.stroke();
              drawArrowHead(senderX, ackRecvY, -Math.PI / 2);
              ctx.fillStyle = "#a66a00";
              ctx.fillText("ACK Timeout!", senderX - 120, ackRecvY + 4);
              const resend2Start = resendStart + 2 * T + 1;
              const resend2SendY = marginTop + resend2Start * unitHeight;
              const resend2RecvY = marginTop + (resend2Start + T) * unitHeight;
              ctx.strokeStyle = "#6a1b9a";
              ctx.beginPath();
              ctx.moveTo(senderX, resend2SendY);
              ctx.lineTo(receiverX, resend2RecvY);
              ctx.stroke();
              drawArrowHead(receiverX, resend2RecvY, Math.PI / 2);
              ctx.fillStyle = "#6a1b9a";
              ctx.fillText(`Final Resend ${i}`, senderX - 110, resend2SendY + 4);
              successCount += 1;
              return;
            }
          }
          // otherwise ack returns successfully
          ctx.strokeStyle = "#28a745";
          ctx.beginPath();
          ctx.moveTo(receiverX, ackSendY);
          ctx.lineTo(senderX, ackRecvY);
          ctx.stroke();
          drawArrowHead(senderX, ackRecvY, -Math.PI / 2);
          ctx.fillStyle = "#222";
          ctx.fillText(`ACK ${i}`, receiverX + 10, ackSendY + 4);
          successCount += 1;
        });

        currentTime = resendStart + 2 * T + 1;
        continue;
      }

      // If frame arrived OK: schedule ACK event (receiver label)
      events.push(() => {
        const ackSendY = marginTop + ackSendTime * unitHeight;
        ctx.fillStyle = "#1b5e20";
        ctx.fillText(`Frame ${i} received`, receiverX + 10, ackSendY + 4);
      });

      // handle ack errors/timeouts if errorType includes ack
      if (ae.ackError || ae.ackTimeout) {
        events.push(() => {
          const ackSendY = marginTop + ackSendTime * unitHeight;
          const ackRecvY = marginTop + ackRecvTime * unitHeight;
          ctx.strokeStyle = "#ff9800";
          ctx.beginPath();
          ctx.moveTo(receiverX, ackSendY);
          ctx.lineTo(senderX, ackRecvY);
          ctx.stroke();
          drawArrowHead(senderX, ackRecvY, -Math.PI / 2);
          ctx.fillStyle = "#a66a00";
          ctx.fillText(ae.ackError ? "ACK Lost!" : "ACK Timeout!", senderX - 120, ackRecvY + 4);
          acksLost += ae.ackError ? 1 : 0;
          retransmissions += 1;
        });

        events.push(() => {
          const resendStart = ackRecvTime + T;
          const resendSendY = marginTop + resendStart * unitHeight;
          const resendRecvY = marginTop + (resendStart + T) * unitHeight;
          ctx.strokeStyle = "#6a1b9a";
          ctx.beginPath();
          ctx.moveTo(senderX, resendSendY);
          ctx.lineTo(receiverX, resendRecvY);
          ctx.stroke();
          drawArrowHead(receiverX, resendRecvY, Math.PI / 2);
          ctx.fillStyle = "#6a1b9a";
          ctx.fillText(`Resend Frame ${i}`, senderX - 110, resendSendY + 4);
        });

        events.push(() => {
          const ackSendY2 = marginTop + (ackRecvTime + T) * unitHeight;
          const ackRecvY2 = marginTop + (ackRecvTime + 2 * T) * unitHeight;
          ctx.strokeStyle = "#28a745";
          ctx.beginPath();
          ctx.moveTo(receiverX, ackSendY2);
          ctx.lineTo(senderX, ackRecvY2);
          ctx.stroke();
          drawArrowHead(senderX, ackRecvY2, -Math.PI / 2);
          ctx.fillStyle = "#222";
          ctx.fillText(`ACK ${i}`, receiverX + 10, ackSendY2 + 4);
          successCount += 1;
        });

        currentTime = ackRecvTime + 2 * T + 1;
        continue;
      }

      // otherwise ack is normal: draw ack arrow
      events.push(() => {
        const ackSendY = marginTop + ackSendTime * unitHeight;
        const ackRecvY = marginTop + ackRecvTime * unitHeight;
        ctx.strokeStyle = "#28a745";
        ctx.beginPath();
        ctx.moveTo(receiverX, ackSendY);
        ctx.lineTo(senderX, ackRecvY);
        ctx.stroke();
        drawArrowHead(senderX, ackRecvY, -Math.PI / 2);
        ctx.fillStyle = "#222";
        ctx.fillText(`ACK ${i}`, receiverX + 10, ackSendY + 4);
        successCount += 1;
      });

      currentTime = ackRecvTime;
    } // end for frames

    // Now animate the events array one-by-one at ~1s intervals (like original behavior)
    let idx = 0;
    function step() {
      if (idx >= events.length) {
        // update stats when done
        statWin.textContent = W;
        statFrames.textContent = N;
        statFramesPerUnit.textContent = (1 / (T || 1)).toFixed(2); // frames per unit
        statTimePerFrame.textContent = T;
        const errFriendly = {
          "none": "No Error (Noiseless)",
          "frame_lost": "Frame Lost",
          "ack_lost": "ACK Lost",
          "frame_timeout": "Frame Timeout",
          "ack_timeout": "ACK Timeout"
        };
        statErrorType.textContent = `${errFriendly[errType]} (${errMode || '—'})`;
        statFramesLost.textContent = framesLost;
        statAcksLost.textContent = acksLost;
        statRetrans.textContent = retransmissions;
        statSuccess.textContent = successCount;
        return;
      }
      // run next event (it draws onto canvas)
      try { events[idx](); } catch (e) { console.error(e); }
      idx++;
      // 1 second delay between events (like before)
      setTimeout(step, 1000);
    }

    // start animation
    step();
  }); // simulateBtn click

  // Clear canvas and stats
  clearBtn.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    statWin.textContent = "-";
    statFrames.textContent = "-";
    statFramesPerUnit.textContent = "-";
    statTimePerFrame.textContent = "-";
    statErrorType.textContent = "-";
    statFramesLost.textContent = "0";
    statAcksLost.textContent = "0";
    statRetrans.textContent = "0";
    statSuccess.textContent = "0";
  });

  // Download canvas + stats as one PNG
  downloadBtn.addEventListener("click", () => {
    const temp = document.createElement("div");
    temp.style.background = "#fff";
    temp.style.padding = "12px";
    temp.style.fontFamily = "Segoe UI, Arial";
    temp.style.width = (canvas.width + 40) + "px";

    // canvas snapshot
    const img = new Image();
    img.src = canvas.toDataURL();
    img.style.maxWidth = "100%";
    img.style.display = "block";
    img.style.marginBottom = "12px";
    temp.appendChild(img);

    // build stats table copy
    const st = document.createElement("table");
    st.style.borderCollapse = "collapse";
    st.style.width = "100%";
    st.style.marginTop = "6px";
    const rows = [
      ["Window Size", statWin.textContent || "-"],
      ["Total Frames", statFrames.textContent || "-"],
      ["Frames per Unit", statFramesPerUnit.textContent || "-"],
      ["Time per Frame", statTimePerFrame.textContent || "-"],
      ["Error Type (mode)", statErrorType.textContent || "-"],
      ["Frames Lost", statFramesLost.textContent || "0"],
      ["ACKs Lost", statAcksLost.textContent || "0"],
      ["Retransmissions", statRetrans.textContent || "0"],
      ["Successful Frames", statSuccess.textContent || "0"]
    ];
    rows.forEach(([k, v]) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      const td = document.createElement("td");
      th.textContent = k;
      td.textContent = v;
      th.style.padding = "6px 8px";
      td.style.padding = "6px 8px";
      th.style.border = "1px solid #e0e0e0";
      td.style.border = "1px solid #e0e0e0";
      th.style.background = "#f1f8ff";
      tr.appendChild(th);
      tr.appendChild(td);
      st.appendChild(tr);
    });

    temp.appendChild(st);
    document.body.appendChild(temp);

    // capture and remove
    html2canvas(temp, { scale: 2 }).then((c) => {
      const link = document.createElement("a");
      link.href = c.toDataURL("image/png");
      link.download = "slinding_window_protocol_timeline_stats.png";
      link.click();
      document.body.removeChild(temp);
    }).catch((err) => {
      console.error("html2canvas error", err);
      alert("Download failed — check console.");
      if (temp.parentNode) document.body.removeChild(temp);
    });
  });


}); // DOMContentLoaded
