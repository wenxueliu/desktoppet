const sections = Array.from(document.querySelectorAll(".doc-section"));
const tocLinks = Array.from(document.querySelectorAll(".manual-toc a"));

function setActive(hash) {
  for (const link of tocLinks) {
    link.classList.toggle("is-active", link.getAttribute("href") === hash);
  }

  const activeLink = tocLinks.find((link) => link.getAttribute("href") === hash);
  if (activeLink && typeof activeLink.scrollIntoView === "function") {
    activeLink.scrollIntoView({ block: "nearest", inline: "center" });
  }
}

if (sections.length && tocLinks.length && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visible[0]) {
        setActive(`#${visible[0].target.id}`);
      }
    },
    { rootMargin: "-25% 0px -55% 0px", threshold: [0, 0.1, 0.5, 1] }
  );

  for (const section of sections) {
    observer.observe(section);
  }
}

const initialHash = window.location.hash;
const hasInitialLink = tocLinks.some((link) => link.getAttribute("href") === initialHash);

if (initialHash && hasInitialLink) {
  setActive(initialHash);
} else if (tocLinks[0]) {
  tocLinks[0].classList.add("is-active");
}

for (const chip of document.querySelectorAll(".hero-chip")) {
  chip.addEventListener("click", (event) => {
    const hash = chip.getAttribute("href");
    if (!hash || !hash.startsWith("#")) {
      return;
    }
    const target = document.querySelector(hash);
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", hash);
      setActive(hash);
    }
  });
}
