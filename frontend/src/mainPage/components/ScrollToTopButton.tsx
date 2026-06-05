import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./ScrollToTopButton.css";

const SCROLL_TOP_THRESHOLD = 200;

const ScrollToTopButton = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SCROLL_TOP_THRESHOLD);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return createPortal(
    <button
      className="scroll-to-top"
      type="button"
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "auto" })}
    >
      ↑
    </button>,
    document.body,
  );
};

export default ScrollToTopButton;
