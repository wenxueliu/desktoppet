const sections = Array.from(document.querySelectorAll(".doc-section"));
const tocLinks = Array.from(document.querySelectorAll(".manual-toc a"));
const manualHero = document.querySelector(".manual-hero");
const siteHeader = document.querySelector(".site-header");
let firstScreenSnapTimer = 0;
let isSnappingFirstScreen = false;
let pendingActiveHash = "";
let pendingActiveTimer = 0;

function updateHeaderShade() {
  if (!manualHero || !siteHeader) return;

  const headerHeight = siteHeader.offsetHeight || 74;
  const heroBottom = manualHero.getBoundingClientRect().bottom;
  const shouldShade = window.scrollY > 96 && heroBottom > headerHeight + 24;
  siteHeader.classList.toggle("is-shaded", shouldShade);
}

function scrollToHash(hash) {
  const target = document.querySelector(hash);
  if (!target) return false;

  const top = getTargetScrollY(target);
  pendingActiveHash = hash;
  window.clearTimeout(pendingActiveTimer);
  pendingActiveTimer = window.setTimeout(() => {
    pendingActiveHash = "";
    updateActiveFromScroll();
  }, 900);
  window.scrollTo({ top, behavior: "smooth" });
  history.replaceState(null, "", hash);
  setActive(hash);
  return true;
}

function getTargetScrollY(target) {
  if (target.id === "start") {
    return getManualBodyScrollY();
  }

  const scrollMarginTop = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
  return Math.max(0, target.getBoundingClientRect().top + window.scrollY - scrollMarginTop);
}

function getManualBodyScrollY() {
  const manualBody = document.querySelector(".manual-body");
  if (!manualBody) {
    return manualHero ? Math.round(manualHero.getBoundingClientRect().height) : 0;
  }

  return Math.max(0, manualBody.getBoundingClientRect().top + window.scrollY);
}

function snapFirstScreen() {
  if (!manualHero || isSnappingFirstScreen) return;

  const heroHeight = Math.round(manualHero.getBoundingClientRect().height);
  const currentY = window.scrollY;

  if (currentY <= 0 || currentY >= heroHeight) return;

  const snapDownThreshold = Math.min(160, Math.round(heroHeight * 0.22));
  const targetY = currentY >= snapDownThreshold ? getManualBodyScrollY() : 0;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  isSnappingFirstScreen = true;
  window.scrollTo({ top: targetY, behavior: prefersReducedMotion ? "auto" : "smooth" });
  window.setTimeout(() => {
    isSnappingFirstScreen = false;
    updateHeaderShade();
  }, prefersReducedMotion ? 80 : 420);
}

function scheduleFirstScreenSnap() {
  window.clearTimeout(firstScreenSnapTimer);
  firstScreenSnapTimer = window.setTimeout(snapFirstScreen, 140);
}

function setActive(hash) {
  for (const link of tocLinks) {
    link.classList.toggle("is-active", link.getAttribute("href") === hash);
  }

  const activeLink = tocLinks.find((link) => link.getAttribute("href") === hash);
  const tocList = activeLink ? activeLink.closest("ol") : null;
  if (activeLink && tocList && tocList.scrollWidth > tocList.clientWidth) {
    const linkCenter = activeLink.offsetLeft + activeLink.offsetWidth / 2;
    tocList.scrollLeft = Math.max(0, linkCenter - tocList.clientWidth / 2);
  }
}

function updateActiveFromScroll() {
  if (!sections.length) return;

  if (pendingActiveHash) {
    const pendingTarget = document.querySelector(pendingActiveHash);
    const pendingTop = pendingTarget ? getTargetScrollY(pendingTarget) : window.scrollY;
    setActive(pendingActiveHash);

    if (Math.abs(window.scrollY - pendingTop) <= 3) {
      pendingActiveHash = "";
      window.clearTimeout(pendingActiveTimer);
    } else {
      return;
    }
  }

  const headerHeight = siteHeader ? siteHeader.offsetHeight || 74 : 74;
  const probeY = headerHeight + 28;
  let activeSection = sections[0];

  for (const section of sections) {
    const rect = section.getBoundingClientRect();
    if (rect.top <= probeY && rect.bottom > probeY) {
      activeSection = section;
      break;
    }

    if (rect.top <= probeY) {
      activeSection = section;
    }
  }

  setActive(`#${activeSection.id}`);
}

const initialHash = window.location.hash;
const hasInitialLink = tocLinks.some((link) => link.getAttribute("href") === initialHash);

if (initialHash && hasInitialLink) {
  setActive(initialHash);
} else if (tocLinks[0]) {
  tocLinks[0].classList.add("is-active");
}

updateHeaderShade();
updateActiveFromScroll();
window.addEventListener("scroll", () => {
  updateHeaderShade();
  updateActiveFromScroll();
  scheduleFirstScreenSnap();
}, { passive: true });
window.addEventListener("resize", () => {
  updateHeaderShade();
  updateActiveFromScroll();
  scheduleFirstScreenSnap();
});

document.addEventListener("click", (event) => {
  const link = event.target.closest(".hero-chip, .hero-scroll-cue, .manual-toc a");
  if (!link) return;

  const hash = link.getAttribute("href");
  if (hash && hash.startsWith("#") && scrollToHash(hash)) {
    event.preventDefault();
  }
});
