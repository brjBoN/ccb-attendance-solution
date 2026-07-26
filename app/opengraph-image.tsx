import { ImageResponse } from "next/og";

export const alt = "Heritage Church Attendance";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "#071f3f",
          color: "white",
          display: "flex",
          height: "100%",
          width: "100%"
        }}
      >
        <div
          style={{
            background:
              "radial-gradient(circle at 20% 10%, rgba(0,153,203,0.42), transparent 42%), linear-gradient(145deg, #071f3f 0%, #083365 58%, #0866ff 100%)",
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 70px"
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              fontSize: 25,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase"
            }}
          >
            <span
              style={{
                background: "#0099cb",
                borderRadius: 999,
                display: "flex",
                height: 18,
                marginRight: 14,
                width: 18
              }}
            />
            Heritage Church
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                color: "#74d9f1",
                fontSize: 25,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase"
              }}
            >
              Group attendance
            </div>
            <div
              style={{
                fontSize: 72,
                fontWeight: 700,
                letterSpacing: "-0.045em",
                lineHeight: 1.03,
                marginTop: 18,
                maxWidth: 780
              }}
            >
              Find your group. Scan once. Check in.
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 28,
                marginTop: 28
              }}
            >
              Simple group schedules and attendance synchronized with CCB.
            </div>
          </div>
        </div>

        <div
          style={{
            alignItems: "center",
            background: "#f4f8fc",
            display: "flex",
            justifyContent: "center",
            width: 310
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "white",
              border: "3px solid #d7e2ee",
              borderRadius: 44,
              boxShadow: "0 28px 70px rgba(7,31,63,0.16)",
              display: "flex",
              height: 196,
              justifyContent: "center",
              width: 196
            }}
          >
            <div
              style={{
                alignItems: "center",
                background: "#0866ff",
                borderRadius: 34,
                display: "flex",
                fontSize: 60,
                fontWeight: 800,
                height: 132,
                justifyContent: "center",
                width: 132
              }}
            >
              QR
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
