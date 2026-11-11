import {
  EMBLEM_ASPECT,
  EMBLEM_FRAME_PATH,
  EMBLEM_SOLID_PATH,
  EMBLEM_VIEWBOX,
} from "@/components/brand/mark-geometry";

const SIZE = 512;
const MARK_HEIGHT = Math.round(SIZE * 0.62);
const MARK_WIDTH = Math.round(MARK_HEIGHT * EMBLEM_ASPECT);

export default function AppIcon() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
      }}
    >
      <svg
        width={MARK_WIDTH}
        height={MARK_HEIGHT}
        viewBox={EMBLEM_VIEWBOX}
        fill="none"
        aria-hidden="true"
      >
        <path d={EMBLEM_FRAME_PATH} fill="#FFDA1A" fillRule="evenodd" />
        <path d={EMBLEM_SOLID_PATH} fill="#0058A3" fillRule="evenodd" />
      </svg>
    </div>
  );
}
