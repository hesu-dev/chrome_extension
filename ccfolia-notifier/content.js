function playSound() {
  const audio = new Audio(chrome.runtime.getURL("notify.mp3"));
  audio.volume = 1.0;
  audio.play().catch(e => console.warn("🔇 알림음 오류:", e));
}

let lastIndex = -1;

function getLastMessageIndex() {
  const messageDivs = document.querySelectorAll("div[data-index]");
  let maxIndex = -1;
  messageDivs.forEach(div => {
    const idx = parseInt(div.getAttribute("data-index"), 10);
    if (!isNaN(idx)) {
      maxIndex = Math.max(maxIndex, idx);
    }
  });
  return maxIndex;
}

function checkNewMessages() {
  const currentIndex = getLastMessageIndex();
  if (currentIndex > lastIndex) {
    lastIndex = currentIndex;
    if (document.visibilityState !== "visible") {
        playSound();
    }
  }
}
lastIndex = getLastMessageIndex();
setInterval(checkNewMessages, 1000);
