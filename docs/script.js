const buttons = document.querySelectorAll(".copy-button");
const panels = document.querySelectorAll(".panel");
const scroller = document.querySelector(".page");
const dots = document.querySelectorAll(".panel-dot");

buttons.forEach((button) => {
  button.addEventListener("click", async () => {
    const text = button.getAttribute("data-copy");
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      const original = button.textContent;
      button.textContent = "Copied!";
      setTimeout(() => {
        button.textContent = original;
      }, 1200);
    } catch {
      window.prompt("Copy this command:", text);
    }
  });
});

if (scroller && panels.length > 0) {
  let activeIndex = 0;

  const setActive = (index) => {
    activeIndex = index;
    panels.forEach((panel, idx) => {
      panel.classList.toggle("is-active", idx === index);
    });
    dots.forEach((dot, idx) => {
      dot.classList.toggle("is-active", idx === index);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = Array.from(panels).indexOf(entry.target);
          if (index !== -1) {
            setActive(index);
          }
        }
      });
    },
    {
      root: scroller,
      threshold: 0.6,
    }
  );

  panels.forEach((panel) => observer.observe(panel));
  setActive(0);

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const index = Number(dot.getAttribute("data-index"));
      if (!Number.isNaN(index) && panels[index]) {
        panels[index].scrollIntoView({ behavior: "smooth", inline: "start" });
      }
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      const next = Math.min(activeIndex + 1, panels.length - 1);
      panels[next].scrollIntoView({ behavior: "smooth", inline: "start" });
    }
    if (event.key === "ArrowLeft") {
      const prev = Math.max(activeIndex - 1, 0);
      panels[prev].scrollIntoView({ behavior: "smooth", inline: "start" });
    }
  });
}
