import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { CachedRecommendation } from "../../types";

const CARD_THEMES = [
  { id: "sage", label: "Sage" },
  { id: "mist", label: "Mist" },
  { id: "clay", label: "Clay" },
  { id: "lilac", label: "Lilac" },
  { id: "sun", label: "Sun" },
];

interface RecommendationCardMenuProps {
  item: CachedRecommendation;
  menuOpen: boolean;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  onColorChange: (id: string, colorTheme: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

const RecommendationCardMenu = ({
  item,
  menuOpen,
  setMenuOpen,
  onColorChange,
  onDelete,
  onRename,
}: RecommendationCardMenuProps) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;

      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen, setMenuOpen]);

  return (
    <div className="card-menu" ref={menuRef}>
      <button
        aria-expanded={menuOpen}
        aria-label="Edit recommendation card"
        className="card-menu-button"
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
      >
        ✎
      </button>

      {menuOpen && (
        <div className="card-menu-popover">
          <label htmlFor={`recommendation-name-${item.id}`}>Name</label>

          <input
            id={`recommendation-name-${item.id}`}
            type="text"
            value={item.name}
            onChange={(event) => onRename(item.id, event.currentTarget.value)}
          />

          <span className="menu-label">Color</span>

          <div className="theme-swatches">
            {CARD_THEMES.map((theme) => (
              <button
                aria-label={theme.label}
                className={`theme-swatch theme-${theme.id}${
                  item.colorTheme === theme.id ? " active" : ""
                }`}
                key={theme.id}
                type="button"
                onClick={() => onColorChange(item.id, theme.id)}
              />
            ))}
          </div>

          <button className="card-delete" type="button" onClick={() => onDelete(item.id)}>
            Delete card
          </button>
        </div>
      )}
    </div>
  );
};

export default RecommendationCardMenu;
