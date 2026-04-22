
  const removeFloatingIncome = React.useCallback((doneId) => {
    setFloatingIncome((prev) => prev.filter((fi) => fi.id !== doneId));
  }, []);
  
  useEffect(() => {
    if (activeReveal) return;
    if (revealQueue.length === 0) return;

    const nextReveal = revealQueue[0];
    const revealDuration = getRevealLockMs(nextReveal, collection);

    playSound(revealSfx, 0.55);

    setActiveReveal(nextReveal);
    setRevealQueue((q) => q.slice(1));
    setRevealLockedUntil(Date.now() + revealDuration);

    const timer = setTimeout(() => {
      setCollection((old) => mergeOpenedIdols(old, [nextReveal]));
      setActiveReveal(null);
      setRevealLockedUntil(0);
    }, revealDuration);

    return () => clearTimeout(timer);
  }, [activeReveal, revealQueue, collection]);

  const createDebugPack = ({ groupName, rarityName, mutationName, cardType, variantName }) => {
    const group = GROUPS.find((g) => g.name === groupName);
    const rarity = RARITIES.find((r) => r.name === rarityName);
    const mutation =
      mutationName === "None"
        ? null
        : MUTATIONS.find((m) => m.name === mutationName);
  
    return {
      id: nextId.current++,
      group: group.name,
      tier: group.tier,
      cardType: cardType || "member",
      forcedVariant: variantName || null,
      cost: group.cost,
      rarity: rarity.name,
      rarityMult: rarity.mult,
      mutation: mutation?.name || null,
      mutationMult: mutation?.mult || 1,
      packImage: group.packImage || null,
      spawnedAt: Date.now(),
      expiresAt: Date.now() + CONVEYOR_LIFETIME_MS,
    };
  };

const createDebugIdol = ({ groupName, memberName, rarityName, mutationName, variantName }) => {
  const group = GROUPS.find((g) => g.name === groupName);
  const member = group.members.find((m) => m.name === memberName);
  const rarityMult = getRarityMultiplier(rarityName);
  const mutationMult =
    mutationName === "None" ? 1 : getMutationMultiplier(mutationName);

  const finalIncome =
    getMemberValue(group, member) * rarityMult * mutationMult;

  return {
    id: nextId.current++,
    name: member.name,
    group: group.name,
    tier: group.tier,
    cardType: "member",
    rarity: rarityName,
    mutation: mutationName === "None" ? null : mutationName,
    incomePerSec: finalIncome,
    baseIncomePerSec: finalIncome,
    level: 1,
    shards: 1,
    nextLevelNeed: 2,
    ownedCosmetics: COSMETICS.map((c) => ({ ...c, level: 0, activeUntil: 0 })),
    activeCosmetics: [],
    variant: variantName || "default",
    unlockedVariants:
      variantName === "signed" ? ["default", "signed"] : ["default"],
    image:
      member.variants?.[variantName || "default"]
      || member.image
      || null,
  };
};

const createDebugGroupIdol = ({ groupName, rarityName, mutationName, variantName }) => {
  const group = GROUPS.find((g) => g.name === groupName);
  const rarityMult = getRarityMultiplier(rarityName);
  const mutationMult =
    mutationName === "None" ? 1 : getMutationMultiplier(mutationName);

  const totalBaseIncome = group.members.reduce((sum, member) => {
    return sum + getMemberValue(group, member);
  }, 0);

  const finalIncome = totalBaseIncome * 0.75 * rarityMult * mutationMult;

  return {
    id: nextId.current++,
    name: group.name,
    group: group.name,
    tier: group.tier,
    cardType: "group",
    rarity: rarityName,
    mutation: mutationName === "None" ? null : mutationName,
    incomePerSec: finalIncome,
    baseIncomePerSec: finalIncome,
    level: 1,
    shards: 1,
    nextLevelNeed: 2,
    ownedCosmetics: [],
    activeCosmetics: [],
    variant: variantName || "default",
    unlockedVariants:
      variantName === "signed" ? ["default", "signed"] : ["default"],
    image:
      group.groupVariants?.[variantName || "default"]
      || group.groupPackImage
      || group.packImage
      || null,
  };
};

const debugAddMoney = () => {
  setMoney((m) => m + Number(debugMoneyInput || 0));
};

const debugSpawnPackToConveyor = () => {
  const pack = createDebugPack({
    groupName: debugGroup,
    rarityName: debugRarity,
    mutationName: debugMutation,
    cardType: debugCardType,
    variantName: debugVariant,
  });

  setConveyor((prev) => [...cleanConveyor(prev), pack].slice(-CONVEYOR_MAX));
};

const debugAddPackToBackpack = () => {
  const pack = createDebugPack({
    groupName: debugGroup,
    rarityName: debugRarity,
    mutationName: debugMutation,
    cardType: debugCardType,
    variantName: debugVariant,
  });

  const key = `${pack.group}|${pack.cardType || "member"}|${pack.rarity}|${pack.mutation || "None"}`;

  setBackpack((prev) => ({
    ...prev,
    [key]: { ...(prev[key] || pack), count: (prev[key]?.count || 0) + 1 },
  }));
};

const debugAddIdolToBinder = () => {
  const idol =
    debugCardType === "group"
      ? createDebugGroupIdol({
          groupName: debugGroup,
          rarityName: debugRarity,
          mutationName: debugMutation,
          variantName: debugVariant,
        })
      : createDebugIdol({
          groupName: debugGroup,
          memberName: debugMember,
          rarityName: debugRarity,
          mutationName: debugMutation,
          variantName: debugVariant,
        });

  setCollection((prev) => mergeOpenedIdols(prev, [idol]));
};

const debugAddAllIdols = () => {
  const allIdols = GROUPS.flatMap((group) =>
    group.members.map((member) =>
      createDebugIdol({
        groupName: group.name,
        memberName: member.name,
        rarityName: "Normal",
        mutationName: "None",
      })
    )
  );

  setCollection((prev) => mergeOpenedIdols(prev, allIdols));
};

const debugClearBinder = () => setCollection([]);
const debugClearConveyor = () => setConveyor([]);
const debugClearBackpack = () => setBackpack({});
const debugClearOpening = () => setOpening([]);

useEffect(() => {
  const selectedGroup = GROUPS.find((g) => g.name === debugGroup);
  if (!selectedGroup) return;
  setDebugMember(selectedGroup.members[0]?.name ?? "");
}, [debugGroup]);

  const buyPack = (pack) => {
    if (money < pack.cost) return;

      playSound(buySfx, 0.4);

    setMoney((m) => m - pack.cost);
    const key = `${pack.group}|${pack.cardType || "member"}|${pack.rarity}|${pack.mutation || "None"}`;
    setBackpack((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || pack), count: (prev[key]?.count || 0) + 1 },
    }));
    setConveyor((prev) => prev.filter((p) => p.id !== pack.id));
  };

  const skipAllReveals = () => {
    const allReveals = [
      ...(activeReveal ? [activeReveal] : []),
      ...revealQueue,
    ];

    if (allReveals.length === 0) return;

    const specialReveals = allReveals.filter((idol) => isSpecialReveal(idol, collection));
    const normalReveals = allReveals.filter((idol) => !isSpecialReveal(idol, collection));

    if (normalReveals.length > 0) {
      setCollection((old) => mergeOpenedIdols(old, normalReveals));
    }

    setActiveReveal(null);
    setRevealQueue(specialReveals);
    setRevealLockedUntil(0);
  };

  const queuePackMultiple = (key, amount) => {
    const pack = backpack[key];
    if (!pack) return;

    const available = pack.count ?? 0;
    if (available < amount) return;

    const freeSlots = maxQueue - openingRef.current.length;
    if (freeSlots < amount) {
      showShopMessage(`Need ${amount} free queue slots.`);
      return;
    }

    const baseSec = OPEN_TIME_BY_TIER_SEC[pack.tier - 1] || 4500;

    const queuedPacks = Array.from({ length: amount }, () => ({
      id: nextId.current++,
      group: pack.group,
      tier: pack.tier,
      cost: pack.cost,
      rarity: pack.rarity,
      mutation: pack.mutation,
      packImage: pack.packImage ?? null,
      baseSec,
      progress: 0,
      lastProgressAt: now(),
      cardType: pack.cardType || "member",
    }));

    setOpening((prev) => {
      const next = [...prev, ...queuedPacks];
      openingRef.current = next;
      return next;
    });

    setBackpack((prev) => {
      const current = prev[key];
      if (!current) return prev;

      const nextCount = current.count - amount;
      if (nextCount <= 0) {
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }

      return {
        ...prev,
        [key]: {
          ...current,
          count: nextCount,
        },
      };
    });

    playSound(buySfx, 0.4);
  };

  const trashPackMultiple = (key, amount) => {
    const pack = backpack[key];
    if (!pack) return;

    const available = pack.count ?? 0;
    if (available < amount) return;

    const refund = pack.cost * 0.3 * amount;

    setMoney((m) => m + refund);

    setBackpack((prev) => {
      const current = prev[key];
      if (!current) return prev;

      const nextCount = current.count - amount;
      if (nextCount <= 0) {
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }

      return {
        ...prev,
        [key]: {
          ...current,
          count: nextCount,
        },
      };
    });

    playSound(trashSfx, 0.4);
  };

  const queuePack = (key) => {
    const pack = backpack[key];
    if (openingRef.current.length >= maxQueue) {
      showShopMessage("Opening queue is full.");
      return;
    }

    const group = GROUPS.find((g) => g.name === pack.group);
    const baseSec = OPEN_TIME_BY_TIER_SEC[group.tier - 1] || 4500;

    setOpening((prev) => [
      ...prev,
      {
        ...pack,
        id: nextId.current++,
        progress: 0,
        lastProgressAt: Date.now(),
        baseSec,
        completed: false,
      },
    ]);

    setBackpack((prev) => {
      const current = prev[key];
      if (!current) return prev;
      const nextCount = current.count - 1;
      if (nextCount <= 0) {
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }
      return { ...prev, [key]: { ...current, count: nextCount } };
    });

    playSound(buySfx, 0.4);
  };

  const trashPack = (key) => {
    const pack = backpack[key];
    if (!pack || pack.count <= 0) return;
    setMoney((m) => m + pack.cost * 0.3);
    setBackpack((prev) => {
      const current = prev[key];
      if (!current) return prev;
      const nextCount = current.count - 1;
      if (nextCount <= 0) {
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }
      return { ...prev, [key]: { ...current, count: nextCount } };
    });
    playSound(trashSfx, 0.4);
  };

  const rollVariant = (pack) => {
    if (pack.cardType === "group") return "default";
    // you can expand this later
    if (Math.random() < 0.02) return "signed";
    return "default";
  };

  const openPack = (pack) => {
    const group = GROUPS.find((g) => g.name === pack.group);
    if (!group) return null;

    const rolledVariant = pack.forcedVariant || rollVariant(pack);

    // GROUP PACK BRANCH
    if (pack.cardType === "group") {
      const totalBaseIncome = group.members.reduce((sum, member) => {
        return sum + getMemberValue(group, member);
      }, 0);

      const finalIncome = safeNumber(
        totalBaseIncome * 0.75 * safeNumber(pack.rarityMult, 1) * safeNumber(pack.mutationMult, 1),
        0
      );

      return {
        id: nextId.current++,
        name: group.name,
        group: group.name,
        tier: group.tier,
        cardType: "group",
        rarity: pack.rarity,
        mutation: pack.mutation,
        incomePerSec: finalIncome,
        baseIncomePerSec: finalIncome,
        level: 1,
        shards: 1,
        nextLevelNeed: 2,
        ownedCosmetics: [],
        activeCosmetics: [],
        variant: rolledVariant,
        unlockedVariants:
          rolledVariant === "signed" ? ["default", "signed"] : ["default"],
        image:
          group.groupVariants?.[rolledVariant]
          || group.groupPackImage
          || group.packImage
          || null,
      };
    }

    // NORMAL MEMBER PACK BRANCH
    const member = weightedPick(group.members, "weight");

    const finalIncome = safeNumber(
      getMemberValue(group, member) * safeNumber(pack.rarityMult, 1) * safeNumber(pack.mutationMult, 1),
      0
    );

    return {
      id: nextId.current++,
      name: member.name,
      group: group.name,
      tier: group.tier,
      cardType: "member",
      rarity: pack.rarity,
      mutation: pack.mutation,
      incomePerSec: finalIncome,
      baseIncomePerSec: finalIncome,
      level: 1,
      shards: 1,
      nextLevelNeed: 2,
      ownedCosmetics: [],
      activeCosmetics: [],
      variant: rolledVariant,
      unlockedVariants:
        rolledVariant === "signed" ? ["default", "signed"] : ["default"],
      image:
        member.variants?.[rolledVariant]
        || member.image
        || null,
    };
  };

  const toggleFavorite = (targetIdol) => {
    setCollection((prev) =>
      prev.map((idol) =>
        idol.group === targetIdol.group && idol.name === targetIdol.name
          ? { ...idol, isFavorite: !idol.isFavorite }
          : idol
      )
    );

    setSelectedIdol((prev) =>
      prev && prev.group === targetIdol.group && prev.name === targetIdol.name
        ? { ...prev, isFavorite: !prev.isFavorite }
        : prev
    );
  };

  const tapIdol = (idol, event) => {
  if (!idol?.discovered && idol.discovered !== undefined) return;
  playSound(coinSfx, 0.3);

  const bonus = (idol.activeCosmetics || []).reduce(
    (acc, c) => acc + (c.activeUntil > Date.now() ? c.tapBonus : 0),
    0
  );

  const earned = getEffectiveIdolIncome(idol, completedGroups) * (1 + bonus);
  setMoney((m) => m + earned);

  if (idol.isNew) {
    setCollection((prev) =>
      prev.map((i) =>
        i.id === idol.id ? { ...i, isNew: false } : i
      )
    );
  }

  

  // Add floating income
  if (event) {
    setFloatingIncome((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        x: event.clientX,
        y: event.clientY,
        amount: earned,
      },
    ]);
  }
};

  const upgradeCosmetic = (idol, key) => {
    const currentLevel = idol.ownedCosmetics.find((c) => c.key === key)?.level || 0;
    const cost = getEffectiveIdolIncome(idol, completedGroups) * 60 * (currentLevel + 1);
    if (money < cost) return;
    setMoney((m) => m - cost);
    setCollection((prev) =>
      prev.map((i) =>
        i.id !== idol.id
          ? i
          : {
              ...i,
              ownedCosmetics: i.ownedCosmetics.map((c) =>
                c.key === key && c.level < 3 ? { ...c, level: c.level + 1 } : c
              ),
            }
      )
    );
  };

  const activateCosmetic = (idol, key) => {
    setCollection((prev) =>
      prev.map((i) =>
        i.id !== idol.id
          ? i
          : {
              ...i,
              activeCosmetics: i.ownedCosmetics
                .filter((c) => c.level > 0)
                .map((c) =>
                  c.key === key ? { ...c, activeUntil: Date.now() + [0, 15000, 30000, 60000][c.level] } : c
                ),
            }
      )
    );
    setSelectedIdol((s) => (s && s.id === idol.id ? { ...s } : s));
  };

  const backpackEntries = Object.entries(backpack).filter(([, pack]) => pack.count > 0);
  const eventColor = eventNow ? EVENT_COLORS[eventNow.mutation] : "#64748b";
  const freeQueueSlots = maxQueue - opening.length;
  const activeRevealIsSpecial = activeReveal ? isSpecialReveal(activeReveal, collection) : false;
  const activeRevealTitle = activeReveal ? getRevealTitle(activeReveal, collection) : "New Pull";
  const revealStillLocked = Date.now() < revealLockedUntil;

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <h1 style={{ marginTop: 0, color: ui.text, fontFamily: 'Comic Sans MS' }}>Idol Collector Prototype</h1>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            style={styles.buttonAlt}
            onClick={openTutorial}
          >
            Help
          </button>

          <button
            style={styles.buttonAlt}
            onClick={() => {
              localStorage.removeItem(SAVE_KEY);
              window.location.reload();
            }}
          >
            Reset Save
          </button>
        </div>

        <div style={{...styles.statsGrid, marginTop: 14}}>
          <div style={styles.card}>
            <div style={styles.small}>Balance</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>${fmt(safeNumber(money, 0))}</div>
            <div style={{ ...styles.small, marginTop: 6, color: ui.incomeText }}>
              +${fmt(safeNumber(passiveIncomePerSec, 0))}/s
            </div>
          </div>
          <div style={styles.card}>
            <div style={styles.small}>Player Tier</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>Tier {playerTier}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.small}>Opening Queue</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{opening.length}/{maxQueue}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.small}>Lightstick</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{equippedLightstick}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.small}>Collection Completion</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{ownedCollectionCount}/{totalCollectionCount}</div>
            <div style={styles.small}>{completionPct.toFixed(1)}% complete</div>
          </div>
          <div style={styles.card}>
            <div style={styles.small}>Set Bonuses Active</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{completedGroups.size}</div>
            <div style={styles.small}>+20% income for each completed group</div>
          </div>
        </div>

        {offlineNotice ? (
          <div style={{ ...styles.card, marginBottom: 16, borderColor: "#0ea5e9" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Offline earnings collected</div>
            <div style={{ marginTop: 4 }}>
              You earned <b>${fmt(offlineNotice.income)}</b> over{" "}
              {Math.floor(offlineNotice.seconds / 60)}m {offlineNotice.seconds % 60}s away.
            </div>
            <div style={{ ...styles.small, marginTop: 6 }}>
              Current offline cap: {offlineCapMinutes} minutes
            </div>
          </div>
        ) : null}

        {eventNow ? (
          <div
            style={{
              ...styles.card,
              marginBottom: 16,
              borderColor: eventColor,
              boxShadow: `0 0 18px ${eventColor}33`,
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              {eventNow.type === "active" ? (
                <>
                  <span style={{ color: eventColor, textShadow: `0 0 8px ${eventColor}66` }}>
                    {eventNow.mutation}
                  </span>{" "}
                  Event ending in
                </>
              ) : (
                <>
                  Next Event - {" "}
                  <span style={{ color: eventColor, textShadow: `0 0 8px ${eventColor}66` }}>
                    {eventNow.mutation}
                  </span>{" "}
                  in:
                </>
              )}
            </div>
            
            <div style={{ marginTop: 4 }}>
              <b>
                {Math.floor(eventNow.remainingSec / 60)}m{" "}
                {eventNow.remainingSec % 60}s
              </b>
            </div>
          </div>
        ) : null}

        <div style={styles.tabs}>
          {["conveyor", "shop", "binder", "sets", ...(debugMode ? ["debug"] : [])].map((name) => (
            <button key={name} style={styles.tabBtn(tab === name)} onClick={() => setTab(name)}>
              {name === "binder" ? "Collection Binder" : name === "shop" ? "Shop": name[0].toUpperCase() + name.slice(1)}
            </button>
          ))}
        </div>

        {tab === "conveyor" && (
          <>
            <ConveyorSection
                conveyor={conveyor}
                styles={styles}
                rarityStyle={rarityStyle}
                mutationStyle={mutationStyle}
                MutationParticles={MutationParticles}
                buyPack={buyPack}
                money={money}
                playHover={playHover}
                fmt={fmt}
                CONVEYOR_LIFETIME_MS={CONVEYOR_LIFETIME_MS}
                MUTATION_VISUALS={MUTATION_VISUALS}
              />
            <div style={{ ...styles.grid2, marginTop: 16 }}>
              <div style={styles.card}>
                <div style={styles.row}>
                  <h2 style={{ marginTop: 0, color: ui.text }}>Backpack</h2>
                  <div style={styles.small}>Queue limit: {maxQueue} packs</div>
                </div>
                {backpackEntries.length === 0 ? <div style={styles.small}>No packs yet.</div> : backpackEntries.map(([key, pack]) => (
                  <div key={key} style={{ ...styles.card, marginBottom: 10, background: ui.panelAlt, border: `1px solid ${ui.cardBorder}`, }}>
                    <div style={styles.row}>
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {pack.group} {pack.cardType === "group" ? "Group Pack" : "Pack"} ×{pack.count}
                        </div>

                        <div style={styles.small}>
                          {getPackTypeLabel(pack)} • {pack.rarity}
                          {pack.mutation ? ` • ${pack.mutation}` : ""}
                        </div>
                      </div>
                    
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        
                        
                        <button style={styles.button} onClick={() => queuePack(key)}>
                          Open
                        </button>
                        
                        {pack.count >= 5 ? (
                          <button
                            style={styles.button}
                            disabled={freeQueueSlots < 5}
                            onClick={() => queuePackMultiple(key, 5)}
                          >
                            Open x5
                          </button>
                        ) : null}

                        {pack.count >= 10 ? (
                          <button
                            style={styles.button}
                            disabled={freeQueueSlots < 10}
                            onClick={() => queuePackMultiple(key, 10)}
                          >
                            Open x10
                          </button>
                        ) : null}

                        <button style={styles.buttonAlt} onClick={() => trashPack(key)}>
                          Trash
                        </button>

                         {pack.count >= 5 ? (
                          <button
                            style={styles.buttonAlt}
                            onClick={() => trashPackMultiple(key, 5)}
                          >
                            Trash x5
                          </button>
                        ) : null}

                        {pack.count >= 10 ? (
                          <button
                            style={styles.buttonAlt}
                            onClick={() => trashPackMultiple(key, 10)}
                          >
                            Trash x10
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.card}>
                <div style={styles.row}>
                  <h2 style={{ marginTop: 0, color: ui.text }}>Opening Queue</h2>
                  <div style={styles.small}>Matching lightstick = 2× speed</div>
                </div>
                {opening.length === 0 ? <div style={styles.small}>No packs opening.</div> : opening.map((pack) => {
                  const pct = pack.progress * 100;
                  const speed = (pack.group === equippedLightstick ? 2 : 1) * managerSpeedMult;
                  const remainingSec = Math.ceil((1 - pack.progress) * pack.baseSec / speed);
                  return (
                    <div key={pack.id} style={{ marginBottom: 12 }}>
                      <div style={styles.row}>
                        <div>
                            <b>
                              {pack.group} {pack.cardType === "group" ? "Group Pack" : "Pack"}
                            </b>
                            <div style={styles.small}>
                              {getPackTypeLabel(pack)} • {pack.rarity}
                              {pack.mutation ? ` • ${pack.mutation}` : ""}
                            </div>
                          </div>
                        <div>
                          {fmtDuration(remainingSec)} {speed > 1 ? <span style={styles.small}>⚡ boosted</span> : null}
                        </div>
                      </div>
                      <div style={{ marginTop: 6 }}>{progressBar(pct, ui)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {tab === "binder" && (
          <div style={styles.card}>
            <h2 style={{ marginTop: 0, color: ui.text }}>Collection Binder</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button style={binderSort === "value" ? styles.button : styles.buttonAlt} onClick={() => setBinderSort("value")}>Sort: Value</button>
              <button style={binderSort === "group" ? styles.button : styles.buttonAlt} onClick={() => setBinderSort("group")}>Sort: Group</button>
              <button style={showUndiscovered ? styles.button : styles.buttonAlt} onClick={() => setShowUndiscovered((prev) => !prev)}>{showUndiscovered ? "Hide Undiscovered" : "Show Undiscovered"}</button>
            </div>
            <div style={styles.binder}>
              {collection.length === 0 ? <div style={styles.small}>Open packs and your binder will fill up here.</div> : binderDisplayList.map((idol) => {
                const effectiveIncome = getEffectiveIdolIncome(idol, completedGroups);
                const setBonusActive = completedGroups.has(idol.group);
                const isHovered = hoveredIdolId === idol.id;
                const isMissing = !idol.discovered;



                return (
                  <div
                    key={`${idol.group}|||${idol.name}`}
                    style={{
                      ...styles.packCard,
                    
                        border: isMissing ? "1px dashed #475569": getRarityBorder(idol.rarity),
                        opacity: isMissing ? 0.7 : 1,
                        width: "100%",
                        marginTop: 10,
                        filter: isMissing ? "grayscale(1)" : "none",
                        transform: isHovered ? "translateY(-6px) scale(1.02)" : "translateY(0) scale(1)",
                        transition: "transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease",
                        boxShadow: isHovered
                          ? idol.rarity === "Ruby"
                            ? "0 0 28px rgb(251, 113, 134)"
                            : idol.rarity === "Diamond"
                            ? "0 0 24px rgb(103, 232, 249)"
                            : idol.rarity === "Gold"
                            ? "0 0 20px rgb(255, 183, 0)"
                            : "0 10px 24px rgba(0,0,0,0.28)"
                          : undefined,
                    }}
                    onClick={isMissing ? undefined : (e) => tapIdol(idol, e)}
                    onMouseEnter={() => {
                      setHoveredIdolId(idol.id);
                      playHover();
                    }}
                    onMouseLeave={() => setHoveredIdolId(null)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (idol.isNew) {
                        setCollection((prev) =>
                          prev.map((i) =>
                             i.group === idol.group && i.name === idol.name
                              ? { ...i, isNew: false }
                              : i
                          )
                        );
                      }
                      setSelectedIdol(idol);
                    }}
                  >
                    <div
                      style={{
                        ...styles.idolBox,
                        padding: getIdolImage(idol) ? 0 : 12,
                        background: isMissing ? "linear-gradient(135deg, rgba(100,116,139,0.2), rgba(30,41,59,0.3))"
                          : getIdolImage(idol) ? "transparent" : styles.idolBox.background,
                        border: isMissing ? "1px solid #475569" : getMutationBorder(idol.mutation),
                        color: isMissing ? "#ffffff00" : getMutationColor(idol.mutation),
                        transition: "box-shadow 0.2s ease, transform 0.18s ease",
                        boxShadow:isMissing ? "none": 
                          idol.mutation === "Astral"
                            ? `0 0 ${isHovered ? 28 : 14}px rgba(207, 74, 255, ${isHovered ? 0.65 : 0.35})`
                            : idol.mutation === "BloodMoon"
                            ? `0 0 ${isHovered ? 28 : 14}px rgba(255, 87, 36, ${isHovered ? 0.7 : 0.45})`
                            : idol.mutation === "Cherry Blossom"
                            ? `0 0 ${isHovered ? 28 : 14}px rgba(255, 166, 215, ${isHovered ? 1 : 0.85})`
                            : "none",
                        animation: "shadowPulse 1s infinite ease-in-out"
                      }}
                    >
                      {getIdolImage(idol) ? (
                        <img src={getIdolImage(idol)} alt={idol.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14, display: "block", position: "relative", zIndex: 1, filter: isMissing ? "grayscale(1) brightness(0.4) blur(6px)"  : "none", }} />
                      ) : (
                        <div style={{ position: "relative", zIndex: 1 }}>
                          <div style={{ fontSize: 24, fontWeight: 800 }}>{idol.name}</div>
                          <div style={{ color: ui.subtext }}>{idol.group}</div>
                        </div>
                      )}

                      {idol.isNew && (
                        <div
                          style={{
                            position: "absolute",
                            top: 10,
                            left: 10,
                            zIndex: 4,
                            padding: "4px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            background: "linear-gradient(90deg, #22c55e, #86efac)",
                            color: "#052e16",
                            boxShadow: "0 0 10px rgba(134,239,172,0.45)",
                          }}
                        >
                          NEW!
                        </div>
                      )}

                      {!isMissing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(idol);
                          }}
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            zIndex: 4,
                            border: "none",
                            background: idol.isFavorite ? "#fbbf24" : "rgba(15,23,42,0.72)",
                            color: idol.isFavorite ? "#111827" : "#e5e7eb",
                            borderRadius: 999,
                            padding: "6px 10px",
                            cursor: "pointer",
                            fontWeight: 800,
                            boxShadow: idol.isFavorite ? "0 0 12px rgba(251,191,36,0.4)" : "none",
                          }}
                        >
                          ★
                        </button>
                      )}

                      {!isMissing && <MutationParticles mutation={idol.mutation} dense={isHovered}/>}
                    </div>
                    <div style={{ ...styles.row, marginTop: 10, alignItems: "flex-start" }}>
                      <span style={styles.levelBadge(idol.level)}>Lv {idol.level}</span>
                      <span style={rarityStyle(idol.rarity)}>{idol.rarity}</span>
                      {idol.mutation ? <span style={mutationStyle(idol.mutation)}>{idol.mutation}</span> : null}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>
                      {idol.cardType === "group" ? `${idol.group} Group Card` : idol.name}
                    </div>

                    <div style={{ fontSize: 16, color: ui.subtext }}>
                      {idol.cardType === "group" ? "Secret Group Pull" : idol.group}
                    </div>
                    {isMissing ? (
                    <>
                      <div style={{ marginTop: 8, fontWeight: 700, color: "#94a3b8" }}>
                        Not owned
                      </div>
                                      
                      <div style={{ ...styles.small, marginTop: 6 }}>
                        Pull Rate: <b style={{color: '#ffffff'}}>{idol.pullChanceText}</b>
                      </div>
                                      
                      <div style={styles.small}>
                        From <b style={{color: '#ffffff'}}>{idol.group}</b> packs
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ marginTop: 6 }}>
                        Income: <b>${fmt(effectiveIncome)}/s</b>
                      </div>
                  
                      <div style={styles.small}>
                        Lv {idol.level} • Stored pulls: {idol.shards}/{idol.nextLevelNeed}
                      </div>
                  
                      {setBonusActive && (
                        <div style={{ ...styles.small, marginTop: 6, color: "#67e8f9" }}>
                          Set bonus active: +20% income
                        </div>
                      )}
                    </>
                  )}</div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "shop" && (
          <div style={styles.grid2}>
            <div style={styles.card}>
              <div style={styles.row}>
                <h2 style={{ marginTop: 0, color: ui.text }}>Upgrades</h2>
                <div style={styles.small}>Permanent account upgrades</div>
              </div>

              <div style={{ ...styles.card, marginTop: 12, background: ui.panelAlt }}>
                <div style={styles.row}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Offline Storage</div>
                    <div style={styles.small}>
                      Increase max offline earnings time by +15 minutes each purchase.
                    </div>
                    <div style={{ ...styles.small, marginTop: 6 }}>
                      Current cap: <b>{offlineCapMinutes} minutes</b> • Level <b>{offlineCapLevel}</b>
                    </div>
                  </div>

                  <button
                    style={styles.button}
                    disabled={money < getOfflineCapUpgradeCost()}
                    onClick={buyOfflineCapUpgrade}
                  >
                    Upgrade (${fmt(getOfflineCapUpgradeCost())})
                  </button>
                </div>
              </div>

              <div style={{ ...styles.card, marginTop: 12, background: ui.panelAlt }}>
                <div style={styles.row}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Queue Slot Expansion</div>
                    <div style={styles.small}>
                      Increase opening queue by +2 slots each purchase.
                    </div>
                    <div style={{ ...styles.small, marginTop: 6 }}>
                      Current max queue: <b>{maxQueue}</b> • Level <b>{queueUpgradeLevel}</b>
                    </div>
                  </div>

                  <button
                    style={styles.button}
                    disabled={money < getQueueUpgradeCost()}
                    onClick={buyQueueUpgrade}
                  >
                    Buy (${fmt(getQueueUpgradeCost())})
                  </button>
                </div>
              </div>

              <div style={{ ...styles.card, marginTop: 12, background: ui.panelAlt }}>
                <div style={styles.row}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Manager System</div>
                    <div style={styles.small}>
                      Boost all pack opening speed by +10% per level.
                    </div>
                    <div style={{ ...styles.small, marginTop: 6 }}>
                      Current bonus: <b>+{Math.round((managerSpeedMult - 1) * 100)}%</b> • Level <b>{managerLevel}</b>
                    </div>
                  </div>

                  <button
                    style={styles.button}
                    disabled={money < getManagerUpgradeCost()}
                    onClick={buyManagerUpgrade}
                  >
                    Hire (${fmt(getManagerUpgradeCost())})
                  </button>
                </div>
              </div>

              {shopNotice ? (
                <div style={{ ...styles.small, marginTop: 12, color: ui.incomeText }}>
                  {shopNotice}
                </div>
              ) : null}
            </div>
            
            <div style={styles.card}>
              <div style={styles.row}>
                <h2 style={{ marginTop: 0, color: ui.text }}>Express Delivery</h2>
                <div style={styles.small}>
                  Force-deliver a target group pack, even if the conveyor is full.
                </div>
              </div>
            
              <div style={{ ...styles.small, marginBottom: 12 }}>
                Delivery fee is 4× base pack price. You still need to buy the delivered pack after it arrives.
              </div>
            
              <div style={{ display: "grid", gap: 10 }}>
                {GROUPS.map((group) => {
                  const fee = getExpressDeliveryCost(group.cost);
                
                  return (
                    <div
                      key={group.name}
                      style={{
                        ...styles.card,
                        background: ui.panelAlt,
                        padding: 12,
                      }}
                    >
                      <div style={styles.row}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{group.name}</div>
                          <div style={styles.small}>
                            Tier {group.tier} • Delivery Fee: ${fmt(fee)}
                          </div>
                        </div>
                    
                        <button
                          style={styles.button}
                          disabled={money < fee}
                          onClick={() => buyExpressDelivery(group.name)}
                        >
                          Deliver
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "sets" && (
          <div style={styles.grid2}>
            {GROUPS.map((group) => {
              const owned = new Set(collection.filter((i) => i.group === group.name).map((i) => i.name));
              const progress = owned.size;
              const done = progress === group.members.length;
              return (
                <div key={group.name} style={styles.card}>
                  <div style={styles.row}>
                    <div style={{ fontWeight: 700, fontSize: 20 }}>{group.name}</div>
                    <span style={done ? styles.pill("#34d399", "#111827") : styles.pill("#475569")}>
                      {done ? "Set Complete" : `${progress}/${group.members.length}`}
                    </span>
                  </div>
                  <div style={{ marginTop: 10 }}>{progressBar((progress / group.members.length) * 100, ui)}</div>
                  <div style={{ ...styles.small, marginTop: 8 }}>
                    {done ? `Bonus active: +${Math.round(SET_BONUS_PER_COMPLETE * 100)}% income for ${group.name} idols.` : `Complete this group to unlock +${Math.round(SET_BONUS_PER_COMPLETE * 100)}% income for that group's idols.`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "debug" && (
  <div style={styles.grid2}>
    <div style={styles.card}>
      <h2 style={{ marginTop: 0, color: ui.text }}>Debug Economy</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="number"
          value={debugMoneyInput}
          onChange={(e) => setDebugMoneyInput(Number(e.target.value))}
          style={{ ...styles.buttonAlt, minWidth: 180 }}
        />
        <button style={styles.button} onClick={debugAddMoney}>
          Add Money
        </button>
      </div>
    </div>

    <div style={styles.card}>
      <h2 style={{ marginTop: 0, color: ui.text }}>Debug Pack / Idol Builder</h2>

      <div style={{ display: "grid", gap: 10 }}>

        <select
          value={debugCardType}
          onChange={(e) => setDebugCardType(e.target.value)}
          style={styles.buttonAlt}
        >
          <option value="member">Member Pack</option>
          <option value="group">Group Pack</option>
        </select>

        <select
          value={debugGroup}
          onChange={(e) => setDebugGroup(e.target.value)}
          style={styles.buttonAlt}
        >
          {GROUPS.map((group) => (
            <option key={group.name} value={group.name}>
              {group.name}
            </option>
          ))}
        </select>

        <select
          value={debugMember}
          onChange={(e) => setDebugMember(e.target.value)}
          style={styles.buttonAlt}
        >
          {(GROUPS.find((g) => g.name === debugGroup)?.members ?? []).map((member) => (
            <option key={member.name} value={member.name}>
              {member.name}
            </option>
          ))}
        </select>
        
        <select
          value={debugVariant}
          onChange={(e) => setDebugVariant(e.target.value)}
          style={styles.buttonAlt}
        >
          <option value="default">Default</option>
          <option value="signed">Signed</option>
        </select>

        <select
          value={debugRarity}
          onChange={(e) => setDebugRarity(e.target.value)}
          style={styles.buttonAlt}
        >
          {RARITIES.map((rarity) => (
            <option key={rarity.name} value={rarity.name}>
              {rarity.name}
            </option>
          ))}
        </select>

        <select
          value={debugMutation}
          onChange={(e) => setDebugMutation(e.target.value)}
          style={styles.buttonAlt}
        >
          <option value="None">None</option>
          {MUTATIONS.map((mutation) => (
            <option key={mutation.name} value={mutation.name}>
              {mutation.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button style={styles.button} onClick={debugSpawnPackToConveyor}>
          Spawn Pack to Conveyor
        </button>
        <button style={styles.button} onClick={debugAddPackToBackpack}>
          Add Pack to Backpack
        </button>
        <button style={styles.button} onClick={debugAddIdolToBinder}>
          Add Idol to Binder
        </button>
      </div>
    </div>

    <div style={styles.card}>
      <h2 style={{ marginTop: 0, color: ui.text }}>Debug Collection Tools</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={styles.button} onClick={debugAddAllIdols}>
          Add All Idols
        </button>
        <button style={styles.buttonAlt} onClick={debugClearBinder}>
          Clear Binder
        </button>
        <button style={styles.buttonAlt} onClick={debugClearConveyor}>
          Clear Conveyor
        </button>
        <button style={styles.buttonAlt} onClick={debugClearBackpack}>
          Clear Backpack
        </button>
        <button style={styles.buttonAlt} onClick={debugClearOpening}>
          Clear Opening Queue
        </button>
      </div>
    </div>
  </div>
)}
        {floatingIncome.map((f) => (
          <FloatingIncomeText 
            key={f.id} 
            id={f.id} 
            amount={f.amount} 
            x={f.x} 
            y={f.y} 
            onDone={removeFloatingIncome}
            />
        ))}

        <div style={{ ...styles.card, marginTop: 16 }}>
          <h2 style={{ marginTop: 0 , color: ui.text}}>Lightsticks</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {GROUPS.map((group) => {
              const price = group.cost * 3;
              const owned = ownedLightsticks.includes(group.name);

              return (
                <button
                  key={group.name}
                  style={{ ...(equippedLightstick === group.name ? styles.button : styles.buttonAlt), textAlign: "left" }}
                  onClick={() => {
                    if (equippedLightstick === group.name) return;

                    if (!owned) {
                      if (money < price) return;
                      setMoney((m) => m - price);
                      setOwnedLightsticks((prev) => [...prev, group.name]);
                    }

                    setEquippedLightstick(group.name);
                    playSound(equipSfx, 0.4)
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{group.name}</div>
                  <div style={styles.small}>{owned ? "Owned" : `$${fmt(price)}`}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeReveal ? (
          <div
            style={styles.modalBg}
            onClick={() => {
              if (!activeReveal) return;
              if (Date.now() < revealLockedUntil) return;

              setCollection((old) => mergeOpenedIdols(old, [activeReveal]));
              setActiveReveal(null);
              setRevealLockedUntil(0);
            }}
          >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              background: ui.panel,
              border: getRarityBorder(activeReveal.rarity),
              borderRadius: 28,
              padding: 24,
              position: "relative",
              overflow: "hidden",
              animation: `revealPop ${REVEAL_DURATION_MS}ms ease forwards`,
              boxShadow: activeReveal.mutation ? MUTATION_VISUALS[activeReveal.mutation]?.glow : "0 24px 60px rgba(0,0,0,0.45)",
            }}
          >
            <div style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
              <div
                style={{
                  ...styles.small,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: activeRevealIsSpecial ? "#facc15" : ui.subtext,
                  textShadow: activeRevealIsSpecial ? "0 0 10px rgba(250,204,21,0.35)" : "none",
                }}
              >
                {activeRevealTitle}
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, marginTop: 8 }}>{activeReveal.name}</div>
              <div style={{ fontSize: 18, color: ui.subtext, marginTop: 6 }}>{activeReveal.group}</div>
              
            </div>
            {activeRevealIsSpecial ? (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    flexWrap: "wrap",
                    marginTop: 12,
                    position: "relative",
                    zIndex: 2,
                  }}
                >
                  {isBrandNewReveal(activeReveal, collection) ? (
                    <span style={styles.pill("linear-gradient(90deg, #22c55e, #86efac)", "#052e16")}>
                      New Card
                    </span>
                  ) : null}

                  {activeReveal.variant === "signed" ? (
                    <span style={styles.pill("linear-gradient(90deg, #f59e0b, #fde68a)", "#3f2a00")}>
                      Signed
                    </span>
                  ) : null}

                  {activeReveal.cardType === "group" ? (
                    <span style={styles.pill("linear-gradient(90deg, #f59e0b, #f472b6)", "#111827")}>
                      Group Card
                    </span>
                  ) : null}
                </div>
              ) : null}
            <div style={{ ...styles.idolBox, 
              padding: getIdolImage(activeReveal) ? 0 : 12, 
              background: getIdolImage(activeReveal) ? "transparent" : styles.idolBox.background, 
              marginTop: 18, 
              minHeight: 290, 
              color: getMutationColor(activeReveal.mutation),
              border: getMutationBorder(activeReveal.mutation), 
              boxShadow: "0 0 24px rgba(255,255,255,0.08)",
              animation: "shadowPulse 1s infinite ease-in-out" 
            }}>
              {getIdolImage(activeReveal) ? (
                <img src={getIdolImage(activeReveal)} alt={activeReveal.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16, position: "relative", zIndex: 1 }} />
              ) : (
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 36, fontWeight: 900 }}>{activeReveal.name}</div>
                  <div style={{ color: ui.subtext, marginTop: 8 }}>{activeReveal.group}</div>
                </div>
              )}
              <MutationParticles mutation={activeReveal.mutation} dense />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 16, position: "relative", zIndex: 2 }}>
              <span style={rarityStyle(activeReveal.rarity)}>{activeReveal.rarity}</span>
              {activeReveal.mutation ? <span style={mutationStyle(activeReveal.mutation)}>{activeReveal.mutation}</span> : null}
              <span style={styles.pill("#0f766e")}>${fmt(safeNumber(activeReveal?.incomePerSec, 0))}/s</span>
            </div>
            {revealQueue.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 16,
                }}
              >
                <button
                  style={styles.buttonAlt}
                  onClick={skipAllReveals}
                >
                  Skip All ({revealQueue.length + 1})
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {selectedIdol ? (
        <div style={styles.modalBg} onClick={() => setSelectedIdol(null)}>
          <div style={{...styles.modal, width: selectedIdol?.cardType === "group" ? "min(475px, 100%)" : "min(950px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.row}>
              <div>
                <h2 style={{ margin: 0, color: ui.text}}>{selectedIdol.name}</h2>
                <div style={styles.small}>{selectedIdol.group}</div>
              </div>
              <button style={styles.buttonAlt} onClick={() => setSelectedIdol(null)}>
                Close
              </button>
            </div>

            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {getAvailableVariantsForIdol(selectedIdol).map((variantDef) => {
                const unlocked = (selectedIdol.unlockedVariants || ["default"]).includes(variantDef.key);
              
                const previewIdol = {
                  ...selectedIdol,
                  variant: getSafeVariantForIdol(selectedIdol, variantDef.key),
                };
              
                return (
                  <button
                    key={variantDef.key}
                    disabled={!unlocked}
                    onClick={() => unlocked && setIdolVariant(selectedIdol, getSafeVariantForIdol(selectedIdol, variantDef.key))}
                    style={{
                      ...styles.card,
                      background: ui.panelAlt,
                      opacity: unlocked ? 1 : 0.55,
                      cursor: unlocked ? "pointer" : "not-allowed",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        ...styles.idolBox,
                        padding: 0,
                        filter: unlocked ? "none" : "grayscale(1) brightness(0.45) blur(6px)",
                        border: unlocked ? `1px solid ${ui.cardBorder}` : "1px dashed #475569",
                      }}
                    >
                      <img
                        src={getIdolImage(previewIdol)}
                        alt={variantDef.label}
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }}
                      />
                    </div>
                    
                    <div style={{ marginTop: 10, fontWeight: 800, color: ui.text }}>{variantDef.label}</div>
                    <div style={styles.small}>
                      {unlocked ? (selectedIdol.variant === variantDef.key ? "Equipped" : "Click to equip") : "Locked"}
                    </div>
                  </button>
                );
              })}
            </div>
              <div style={{ ...styles.card, marginTop: 12 }}>
                  <button
                    style={styles.button}
                    onClick={(e) => tapIdol(selectedIdol, e)}
                  >
                    Tap for Cash
                  </button>
            </div>
          </div>
        </div>
      ) : null}


      {showTutorial && (
        <div style={styles.modalBg} onClick={closeTutorial}>
          <div
            style={{
              ...styles.modal,
              width: "min(780px, 100%)",
              maxWidth: 780,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                position: "relative",
                minHeight: 52,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 0,
                  transform: "translateX(-50%)",
                  textAlign: "center",
                  width: "100%",
                  maxWidth: "80%",
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    ...styles.small,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  How to Play
                </div>
                
                <h2 style={{ margin: 0, color: ui.text }}>
                  {tutorialPages[tutorialPage].title}
                </h2>
              </div>
                
              <button
                style={{
                  ...styles.buttonAlt,
                  position: "absolute",
                  top: 0,
                  right: 0,
                  zIndex: 2,
                }}
                onClick={closeTutorial}
              >
                Close
              </button>
            </div>
                
            <div
              style={{
                marginTop: 18,
                background: ui.panelAlt,
                border: `1px solid ${ui.cardBorder}`,
                borderRadius: 18,
                padding: 18,
                lineHeight: 1.6,
                fontSize: 16,
                color: ui.text,
                minHeight: 280,
              }}
            >
              {tutorialPages[tutorialPage].content}
            </div>
            
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 8,
                marginTop: 16,
              }}
            >
              {tutorialPages.map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: idx === tutorialPage ? ui.button : ui.cardBorderSoft,
                    opacity: idx === tutorialPage ? 1 : 0.55,
                  }}
                />
              ))}
            </div>
            
            <div
              style={{
                ...styles.small,
                textAlign: "center",
                marginTop: 10,
              }}
            >
              {tutorialPage + 1} / {tutorialPages.length}
            </div>
            
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                marginTop: 20,
              }}
            >
              <button
                style={styles.buttonAlt}
                disabled={tutorialPage === 0}
                onClick={() => setTutorialPage((p) => Math.max(0, p - 1))}
              >
                Back
              </button>
            
              {tutorialPage === tutorialPages.length - 1 ? (
                <button style={styles.button} onClick={finishTutorial}>
                  Start Collecting
                </button>
              ) : (
                <button
                  style={styles.button}
                  onClick={() =>
                    setTutorialPage((p) =>
                      Math.min(tutorialPages.length - 1, p + 1)
                    )
                  }
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    <button
      onClick={cycleTheme}
      style={{
        position: "fixed",
        left: 20,
        bottom: 20,
        zIndex: 9999,
        padding: "10px 14px",
        borderRadius: 999,
        border: `1px solid ${ui.cardBorderSoft}`,
        background: ui.panel,
        color: ui.text,
        cursor: "pointer",
        fontWeight: 700,
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
        backdropFilter: "blur(8px)",
      }}
    >
      Theme: {THEMES[theme]?.label ?? theme}
    </button>
    
    </div>
  );
}
