import React, { useState } from "react";

export default function ConveyorSection({
  conveyor,
  styles,
  rarityStyle,
  mutationStyle,
  MutationParticles,
  buyPack,
  money,
  fmt,
  playHover,
  CONVEYOR_LIFETIME_MS,
  MUTATION_VISUALS
}) {

const [hoveredPackId, setHoveredPackId] = useState(null);



  return (
    <div
      style={{
        position: "relative",
        height: 450,
        borderRadius: 22,
        overflow: "hidden",
        border: "1px solid #334155",
        background:
          "linear-gradient(180deg, rgba(15,23,42,0.6), rgba(15,23,42,0.85)), repeating-linear-gradient(90deg, rgba(100,116,139,0.12) 0px, rgba(100,116,139,0.12) 40px, rgba(15,23,42,0.2) 40px, rgba(15,23,42,0.2) 80px)",
        
        }}
    >
      {/* Belt shine */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "-20%",
          width: "30%",
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255, 0, 0, 0.08) 45%, rgba(255, 0, 0, 0.18) 50%, rgba(255,255,255,0.08) 55%, transparent 100%)",
          transform: "skewX(-18deg)",
          animation: "beltShine 4.5s linear infinite",
          pointerEvents: "none"
        }}
      />

      {conveyor.map((pack) => {
        const lifeProgress = Math.max(
          0,
          Math.min(
            1,
            (Date.now() -
              (pack.spawnedAt || pack.expiresAt - CONVEYOR_LIFETIME_MS)) /
              CONVEYOR_LIFETIME_MS
          )
        );

        const leftPct = lifeProgress * 105;
        const isHovered = hoveredPackId === pack.id;
        const msLeft = pack.expiresAt - Date.now();
        const isWarning = msLeft <= 8000;
        const isUrgent = msLeft <= 3000;

        return (
          <div
            key={pack.id}
            onMouseEnter={() => {setHoveredPackId(pack.id);
              playHover();
            }}
            onMouseLeave={() => setHoveredPackId(null)}
            style={{
              ...styles.packCard,
              position: "absolute",
              top: 18,
              left: `${leftPct}%`,
              transition: "left 260ms linear, transform 180ms ease, box-shadow 180ms ease",
                transform: isHovered
                  ? `translateX(-${leftPct * 0.18}%) scale(1.035)`
                  : `translateX(-${leftPct * 0.18}%) scale(1)`,
                boxShadow: isHovered
                  ? pack.mutation
                    ? MUTATION_VISUALS[pack.mutation]?.glow || "0 18px 34px rgba(0,0,0,0.35)"
                    : "0 18px 34px rgba(0,0,0,0.35)"
                  : pack.mutation
                  ? MUTATION_VISUALS[pack.mutation]?.glow
                  : "0 10px 28px rgba(0,0,0,0.25)",
                overflow: "hidden",
                zIndex: isHovered ? 8 : 2
              
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.2,
                background:
                  "linear-gradient(135deg, rgba(255, 0, 132, 0.5), transparent 60%)"
              }}
            />

            <div
              style={{
                ...styles.row,
                alignItems: "flex-start",
                position: "relative",
                zIndex: 2
              }}
            >
              <span style={rarityStyle(pack.rarity)}>{pack.rarity}</span>
              {pack.mutation ? (
                <span style={mutationStyle(pack.mutation)}>
                  {pack.mutation}
                </span>
              ) : null}
            </div>

            <div
              style={{
                ...styles.idolBox,
                marginTop: 10,
                aspectRatio: "5 / 3.25",
                minHeight: 88,
                padding: 0,
                overflow: "hidden",
                background: pack.packImage
                  ? "rgba(15,23,42,0.2)"
                  : "linear-gradient(135deg, rgba(236,72,153,0.22), rgba(34,211,238,0.16))"
              }}
            >
              {pack.packImage ? (
                <img
                  src={pack.packImage}
                  alt={`${pack.group} pack`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: 14
                  }}
                />
              ) : (
                <div>
                  <div style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 6 }}>
                    Pack Art Slot
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>
                    {pack.group}
                  </div>
                </div>
              )}

              <MutationParticles mutation={pack.mutation} />
            </div>

            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                marginTop: 10,
                position: "relative",
                zIndex: 2
              }}
            >
              {pack.group}
            </div>

            <div style={styles.small}>Tier {pack.tier} Pack</div>

            <div style={{ marginTop: 8, position: "relative", zIndex: 2 }}>
              Cost: <b>${fmt(pack.cost)}</b>
            </div>
            
            <div style={{ ...styles.small, margin: "10px 0", position: "relative", zIndex: 2 }}>
                        Belt Exit: {Math.max(0, Math.ceil((pack.expiresAt - Date.now()) / 1000))}s
                      </div>
            <button
              className="buyButton"
              style={{
                ...styles.button,
                width: "100%",
                position: "relative",
                zIndex: 5
              }}
              disabled={money < pack.cost}
              onClick={() => buyPack(pack)}
            >
              Buy Pack
            </button>
          </div>
        );
      })}
    </div>
  );
}