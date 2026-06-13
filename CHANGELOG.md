# Changelog

All notable changes to woe-party. The `APP_VERSION` constant in `index.html` (shown in the
app footer) is a calendar version `YYYY.MM.DD`. Bump it whenever you ship a user-visible
change to `index.html`; add an entry here. Git history is the detailed record — this file
is the human-readable highlight reel.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]
- _nothing yet_

## [2026.06.13.3]
### Changed
- **Fuso horário Bangkok → Brasília (UTC−3).** Toda a lógica de "hoje" / dia de evento /
  reset de folga / gate de pedir leilão / timestamps agora usa horário de Brasília (offset
  fixo −3; Brasil sem horário de verão). Exibição via `America/Sao_Paulo`. Schedule inalterado
  (Ter/Qui GL · Dom Overrun · 21:00–22:00), só agora local; o dia vira à meia-noite do Brasil.
  Helpers mantêm os nomes legados `bkkNow`/`todayBkkISO`/`bkkDow`. Cópia (Ajuda + landing) +
  docs atualizados.

## [2026.06.13.2]
### Added
- **Nova aba ❓ Ajuda / Help (in-app, bilíngue pt-BR/EN).** Guia "como usar" com regras de
  evento (GL Ter/Qui · Overrun Dom · leilão 21:00–22:00 · folga reseta seg 00:00), passo a
  passo de cada funcionalidade (selo 🔒 Admin em Roleta/Users/Mapas) e FAQ. Modo `help`
  visível a todos; conteúdo via `t()` (segue o seletor PT|EN).

## [2026.06.13.1]
### Changed
- **Backend movido para o projeto Firebase próprio `miojo-rooc`** (era `woe-party`/Cybodies).
  `FIREBASE_CONFIG` repointado; admin bootstrap agora `sostenesfreitas@gmail.com` (em
  `ADMIN_EMAILS` + `database.rules.json` + docs). Banco novo nasce vazio → novos players
  entram do zero (sem necessidade de wipe). Rules publicadas no projeto novo (RTDB us-central1).
  Deploy agora no repo próprio `sostenesfreitas/one-o-clock-woe` (GitHub Pages).

## [2026.06.12.9]
### Added
- **i18n Fase 2 — tradução completa das telas secundárias + landing (pt-BR / English).**
  Traduzidas: Summary + AI Comment, Folgas, Roleta, Users, Pedidos de leilão (render +
  modal + gate + ~70 toasts/confirms varridos globalmente), diálogos estáticos, status do
  header, página de análise de batalha GL, painéis de login/admin/auditoria, sidebar/membros,
  upload de mapa, sobras do Roster, e a **landing `index.html`** (mini-i18n próprio + seletor
  PT|EN, compartilha `woe_locale`). Datas agora locale-aware (Gregoriano + meses pt/en via
  `dowName`/`fmtDate`; helpers tailandês-budista removidos). **Meta: zero tailandês renderizado
  ao vivo** (restam só comentários, defaults de dados `ตี้ N` localizados em display por
  `partyLabel`, nomes mock do dataset GL, e código de tooltip desabilitado).

## [2026.06.12.8]
### Added
- **i18n Fase 2 — plural() helper + strings concordam com n=1.** `plural(n, baseKey)` escolhe
  `<key>_one` quando `n===1`, caso contrário `<key>`. Adicionadas chaves singulares:
  `unit.people_one` ("1 pessoa" / "1 person") e `roster.job_count_one` ("1 classe" / "1 job").
  Todos os call sites de `t('unit.people',…)` e `t('roster.job_count',…)` migrados para
  `plural(…)`. Chaves `ai.*` que tinham `{n} pessoas` embutido refatoradas para receber
  `{ppl}` (já pluralizado). Linha "Mover N:" simplificada (removido `ai.people_colon`).
  Glossário `docs/i18n-glossary.md` atualizado.

## [2026.06.12.7]
### Added
- **i18n Fase 1 — traduzidas as telas principais (pt-BR / English).** nav + sidebar,
  League, Overrun, Roster, e a view de Leilão (GL + Overrun) agora aparecem 100% em
  pt-BR (padrão) ou inglês via o seletor `PT | EN`. Nomes de party localizados
  (`Grupo N` / `Party N`) sem reescrever dados; jargão de jogo (Card/White/Black/
  Knight/etc.) mantido em inglês. Glossário em `docs/i18n-glossary.md`.
- _As telas secundárias (Summary, Folgas, Roleta, Users, pedidos de leilão, diálogos,
  toasts) seguem em tailandês — Fase 2._

## [2026.06.12.6]
### Added
- **i18n: เพิ่มสวิตช์ภาษา PT | EN ที่ header.** ระบบแปลกลาง (`LOCALES` + `t()`),
  ค่าเริ่มต้น **pt-BR**, สลับเป็นอังกฤษได้สด ๆ ไม่ต้องรีโหลด. จำค่าภาษาแบบ **ราย-อุปกรณ์**
  (`localStorage`, อยู่นอก `state` — ไม่ sync ขึ้น Firebase, แต่ละคนเลือกของตัวเอง).
- _Fase 0 = เฉพาะ engine + สวิตช์; ยังไม่ได้แปลข้อความในหน้าจอ (ตามแผน faseado)._

## [2026.06.12.5]
### Changed
- **Overrun: เปลี่ยนชื่อกลุ่ม "พิเศษ" → "Purple"** ให้เข้าชุด Red/Yellow/Green/Blue (ตี้ 15,16 เหมือนเดิม).
- **จัด layout การ์ดกลุ่ม Overrun ใหม่ (masonry).** เดิมเป็น grid ที่ยืดการ์ดให้สูงเท่ากันทั้งแถว —
  การ์ด 2 ตี้เลยมีพื้นที่ว่างโบ๋ข้างใน และกลุ่มเล็กตกไปอยู่แถวล่างเดียวดาย; ตอนนี้การ์ดสูงตามเนื้อหา
  และสองคอลัมน์ balance อัตโนมัติ (Red+Yellow / Green+Blue+Purple) ทั้งหน้าแน่นเรียบร้อย.

## [2026.06.12.4]
### Fixed
- **หน้าแมพ: hard-gate หมุด/ลูกศร/วงระยะ เป็น admin-only — guest เหลือ filter/ระยะ/Expand (ดูอย่างเดียว).**
  เดิม guest ลาก/คลิก/คลิกขวาหมุดได้บนจอตัวเอง (rules บล็อกตอน persist อยู่แล้ว → ภาพหลอก: เห็นว่าขยับได้
  แต่หายเองตอน snapshot ใหม่ + คลิกหมุดเฉยๆ = ล้างเส้นทางบนจอตัวเอง). ตอนนี้ listener ไม่ถูก attach เลย
  สำหรับ non-admin (`attachMarkerDrag` / `attachMarkerDragOverrun` / `attachRangeCircleDrag` guard ที่ต้นฟังก์ชัน
  + `clearArrows` มี gate), ปุ่ม 🗑 Clear arrows ซ่อนจาก guest แทนด้วยป้าย "🔒 ดูอย่างเดียว" ทั้งการ์ด League
  ทั้ง 4 และ Overrun. ปิด soft-gate ที่ note ไว้ตอน audit 2026-06-09.

## [2026.06.12.3]
### Changed
- **Job Breakdown: เช็คแบบเป๊ะ ๆ — มี ≠ เป้า คือเตือนทันที ไม่มี "ใกล้เคียง" อีกแล้ว.**
  เดิมเพี้ยน ±1 ยังนับ "สมดุล" (เช่น 15/16) ทำให้รูโหว่ซ่อนอยู่; ตอนนี้สถานะบอกส่วนต่างตรง ๆ
  ("เกิน 2" / "ขาด 1") และ AI Comment แม่นขึ้น: บรรทัดสรุป "เทียบเป้ารวม มี X/เป้า Y →
  ขาด/เกินสุทธิ Z" + คำแนะนำจับคู่ย้ายอาชีพแบบระบุจำนวน ("ย้าย 2 คน: Summoner → Bard").
- **หน้า GL: เรียงแผนที่ใหม่เป็น หลัก-หลัก / รอง-รอง.** เดิม หลัก-รอง / หลัก-รอง ทำให้
  สนามรองคั่นกลางระหว่างสองแผนของสนามหลัก.
### Added
- **🖼 ปุ่มอัปโหลดรูปแผนที่ (admin) กลับมาแล้ว — ครบทุก map ทั้ง GL (4) และ Overrun (1).**
  รูปถูกบีบอัดอัตโนมัติฝั่งเครื่อง (JPEG ≤ ~660KB) เก็บใน Realtime DB node ใหม่ `map_images`
  (read=authed, write=admin, จำกัดชนิด/ขนาดใน rules) — ทุกเครื่องเห็นรูปใหม่ทันที, ปุ่ม
  "↺ รูปเดิม" ลบกลับไปใช้รูปมาตรฐานได้, ไม่แตะ Firebase Storage และไม่ทำให้ localStorage บวม
  (เก็บนอก state). ต้อง publish Database Rules ก่อนใช้.

## [2026.06.12.2]
### Changed
- **Overrun: เพิ่มกลุ่มที่ 5 สีม่วง "พิเศษ" (ตี้ 15,16) — แบ่งมาจาก Blue.**
  กลุ่มสีตอนนี้: Red 1-4 · Yellow 5-8 · Green 9-12 · **Blue 13-14** · **พิเศษ(ม่วง) 15-16**.
  ตัวตี้/รายชื่อ/slot ไม่ขยับ (id เดิมทุกตี้ — คนที่จัดไว้ในตี้ 15,16 แค่เปลี่ยนกลุ่มสีเป็นม่วง).
  การ์ดกลุ่ม, หมุดบนแผนที่ Overrun (หมุด #5 เริ่มกลางแผนที่), ลูกศรเดินทัพ, ชิปกรองกลุ่ม,
  tooltip และแถบสีแท็บ ตามมาครบอัตโนมัติ. League 16 ตี้เหมือนเดิมทุกอย่าง.

## [2026.06.12.1]
### Added
- **ขอประมูล: โชว์เวลาที่ขอ 🕐 + เลขคิว #N — เรียงคิวใครมาก่อนมาหลังได้แล้ว.**
  ทุกแถวคำขอ (ทั้งฝั่ง admin และ "คำขอของฉัน") แสดงเวลาที่ส่งคำขอ HH:MM:SS (เวลาไทย,
  จาก `requestedAt` ที่บันทึกอยู่แล้ว — ข้อมูลเก่าโชว์ "—"). กลุ่ม **รออนุมัติ** เปลี่ยนเป็น
  เรียงตามเวลาล้วน ๆ (first-come-first-served) พร้อมเลขคิว #1, #2, … ไล่กดอนุมัติบนลงล่าง
  = ตามคิวพอดี (ป้าย หลัก/รอง ยังติดอยู่ทุกแถว). ส่วน อนุมัติแล้ว/ปฏิเสธ + ปุ่มจัดสรรอัตโนมัติ
  พฤติกรรมเดิม. ไม่มีการแก้ Firebase rules.
- **เวลาคำขอใช้นาฬิกาเซิร์ฟเวอร์ (`ServerValue.TIMESTAMP`)** — กันเครื่องสมาชิกตั้งเวลาเพี้ยน/
  ย้อนเวลาแล้วแซงคิว (คำขอใหม่ตั้งแต่เวอร์ชันนี้; คำขอเก่าใช้เวลาที่บันทึกไว้เดิม).

## [2026.06.11.2]
### Changed
- **Auction GL: ถอดระบบคูณโบนัส (×) ออกทั้งหมด — กรอกจำนวนของสุทธิเองตรง ๆ.**
  Section "⭐ Bonus rate" (ปุ่ม 0/50/70/100% + ตาราง Base→คูณ→หลัง Bonus), pill "Bonus: %",
  สูตร การ์ด/Illusion ×2 + ขน ×(1+%/100) ใน `computeAuction`, `setAuctionPercent()` และ
  field `bonusPercent` ถูกลบหมด (normalize ตัดทิ้งจาก save เก่าอัตโนมัติ). ช่องกรอกเปลี่ยน
  หัวข้อเป็น "📦 จำนวนของ (กรอกยอดจริงที่จะแจก)" — พิมพ์เท่าไหร่ระบบใช้เท่านั้น.
  ส่วนอื่นเดิมทั้งหมด: แบ่งสนามหลัก/รอง %, rate ต่อคน, ลากชื่อ, page map, Overrun.

## [2026.06.11.1]
### Added
- **🎡 หน้า "สุ่มรางวัล" (admin-only): วงล้อสุ่มผู้โชคดีจากรายชื่อใน Roster.**
  แท็บใหม่เห็นเฉพาะ admin (pattern เดียวกับ Users — `seg-admin` + จอล็อกใน `buildWheelHtml()`).
  ทุกคนใน roster อยู่ในวงล้อ**ทุกรอบ** (ตั้งใจ — ไม่มี auto-remove ผู้ชนะ); admin ติ๊กคนออกได้ชั่วคราว
  (ราย session, ไม่ sync) + ปุ่ม "🌴 ตัดคนลาวันนี้ออก" (อ่านจาก `/leaves` + ธงลาใน Roster).
  ผลถูกสุ่มด้วย `crypto.getRandomValues` (rejection sampling, ไม่มี bias) **ก่อน**เริ่มแอนิเมชัน —
  วงล้อหมุน ~4.6 วิเป็นแค่การแสดงผล. หลังหมุน: modal ผู้ชนะ + confetti → **บันทึกผล** (เขียน
  `/wheel_history`: เวลา/ผู้ชนะ/รางวัล/คนสุ่ม, เก็บล่าสุด 200 รายการ, ลบรายการได้) หรือ **ไม่นับรอบนี้**.
  Database Rules เพิ่ม node `wheel_history` (read=authed, write=admin, shape-locked `$other:false`).
  ป้องกัน snapshot กลางคัน: render ข้ามหน้า wheel ระหว่าง `wheelUI.spinning`.

## [2026.06.10.1]
### Added
- **Roster self-service: สมาชิก (Guest) แก้ข้อมูลแถวตัวเองได้ครบทุกช่อง — ชื่อ / Job / Discord / Discord ID / CP.**
  กด "เลือกชื่อตัวเอง" บน toolbar (ระบบ claim เดียวกับหน้า "ขอประมูล" — จำใน browser, sync กันสองหน้า) แล้วแถวตัวเอง
  จะ highlight เขียว; แถวคนอื่น read-only. **Job/CP ที่เดิม guest แก้ได้ทุกแถว ถูกจำกัดเหลือแถวตัวเอง**
  (ตั้งใจ — กันเคสมือบอนแบบ Overrun). ทุกการแก้ stamp `updatedBy` (ชื่อที่ claim / อีเมล admin) โชว์ใต้ Last Update.
  หมายเหตุ: claim เป็น localStorage ฝั่ง client = UX gate **ไม่ใช่ security boundary** (Database Rules อนุญาต authed
  update `/members/$mid` อยู่แล้วตั้งแต่เดิม) — `updatedBy` ให้ social accountability + client validation คุม input.
- **ปุ่ม 💾 เซฟ สำหรับแถวตัวเอง (draft mode).** ช่องของ guest ไม่เซฟทีละช่องตอน blur แล้ว — พิมพ์รวมแล้วกดปุ่มเดียว
  เขียนทั้ง 5 ฟิลด์เป็น write เดียว + toast "✅ เซฟแล้ว"; ปุ่มเปลี่ยนสีเมื่อมีแก้ค้าง (dirty). ระหว่าง draft เปิดอยู่
  ระบบพัก re-render จาก Firebase snapshot (pattern เดียวกับ `_isDragging`) กันพิมพ์ค้างแล้วโดนลบ; ช่องค้นหา
  carry draft ข้าม rebuild. ฝั่ง admin คงพฤติกรรมเดิม (แก้ปุ๊บเซฟปั๊บทุกแถว). ปุ่มยืนยัน claim ใช้คำว่า "ยืนยัน"
  (เดิม "บันทึก") กันสับสนกับปุ่มเซฟข้อมูล.
### Security
- **database.rules.json: `/members/$mid` ถูก shape-lock เต็มรูปแบบ** — `.validate` ราย field (string ≤64/≤32,
  cp number 0..100M, updatedAt number, onLeave* boolean), `"$other": false` ปัด key แปลกปลอม (กัน storage abuse —
  ปลอดภัยเพราะ writer ทุกตัวใช้ 9 keys ที่ validate ครบ; `.validate` ไม่ retroactive กับข้อมูลเก่า มีผลเฉพาะ write ใหม่)
  และ lock ลูกใต้ทุก field (`"$x": false`) ปิดช่อง RTDB ที่ parent `.validate` ไม่ถูก evaluate เวลาเขียนลึกกว่า field
  (เช่นเขียน `/name/child` เปลี่ยน string เป็น object ได้). `name` ยอมรับ `""` (dedupe ghost rows — ห้ามว่างเฉพาะ
  ฝั่ง client). Security review (2 มุม: client XSS/authz + rules adversarial) = **SAFE TO PUBLISH**, ปิด stored-XSS
  เก่าผ่าน string cp ไปด้วย. **ยังไม่ deploy — ต้อง publish ใน Firebase console หรือ `firebase deploy --only database`
  แล้วเทสใน rules simulator ก่อน** (เคสทดสอบ: anon เขียน `cp="abc"` → Deny, เขียน object ลง `name` → Deny).
- **updatedBy ฝั่ง guest ติด prefix "👤"** — admin stamp (อีเมล) ไม่มีทางขึ้นต้นด้วย 👤 ดังนั้น guest ที่เปลี่ยนชื่อ
  ตัวเองเป็นอีเมล admin จะปลอม stamp ให้ดูเหมือน admin ผ่าน UI ไม่ได้.
### Fixed
(จาก /code-review 7 มุม ก่อน merge)
- **ทุก writer ของ `/members` clamp payload ตาม rules + ติด `.catch` แจ้ง toast** (`rosterClampFields` /
  `rosterWriteFailed`): เดิม เพิ่มสมาชิก/Import/Dedupe/Migrate ส่งค่าเกิน validator ได้ → หลัง publish rules
  write จะโดนปัดตกแบบเงียบ หรือ abort batch กลางคัน (เช่น Discord ID 18 หลักหลุดไปช่อง CP ใน Sheet).
- **Migrate ไม่ลบ discord/discordId อีกแล้ว** — เดิม `.set()` ด้วย payload ไม่ครบ field ทับทั้ง node
  (คลิกเดียวลบข้อมูล Discord ทั้ง guild ได้); ตอนนี้ส่งครบ + stamp `updatedBy`.
- **updatedAt↔updatedBy ต้องคู่กันเสมอ**: Import/Dedupe เดิม stamp เวลาใหม่แต่คงชื่อคนแก้เก่า → โทษคนผิด
  (misattribution); ตอนนี้ทุก write ที่แตะ `updatedAt` stamp ผู้กระทำจริงผ่าน `rosterActorName()`.
- **Ghost rows (ชื่อว่าง) ไม่โผล่ใน dropdown เลือกชื่อ** — เดิมเลือกได้แล้วได้แถวนิรนาม `updatedBy:"guest"`.
- **ค่าที่เลือกค้างใน dropdown เลือกชื่อ รอด re-render** — เดิมโดนรีเซ็ตทุกครั้งที่มีคนแก้ข้อมูล (คืนวอร์แทบเลือกไม่ทัน).
- **Guest แก้แถวที่เพิ่งถูกลบ → เห็น error จริง** ไม่ใช่หน้าจอโชว์ค่าที่ไม่ได้เซฟ (`.catch` + re-render resync).
- ป้าย "admin only" บนหัวคอลัมน์ Job ที่ผิดมาตลอด (job แก้ได้โดย guest อยู่แล้ว) — เอา badge ชุดนี้ออก + ลบ CSS
  `.badge` ที่ตายแล้ว; loader/dedupe/migrate coerce `cp` เป็น number กัน legacy string CP ชน rules validate.
- Cleanup: claim เป็น concept กลาง (`claimGetMemberId`/`claimSetMember` + `claimOptionsHtml` ใช้ร่วม 2 หน้า,
  `ar*` เป็น alias เดิม), แยก `rosterActorName`/`rosterStaticCell` แทนโค้ดซ้ำ, test กัน limits drift
  (client constants ต้องเท่ากับตัวเลขใน rules เสมอ).

## [2026.06.09.3]
### Fixed
- **ปุ่ม "📷 Upload" ในการ์ดแมพ League กดแล้ว error (`setMapBg is not defined`).** handler `setMapBg`/`uploadMapToStorage`
  ถูก retire ไปแล้ว (รูปแมพฝังเป็น static asset) แต่ปุ่มยังค้างใน `buildMapHtml` (แมพ 1/2/4/5) จึง throw เวลากด.
  เอาปุ่มออกให้ตรงกับการ์ด Overrun ที่เอาออกไปก่อนแล้ว + ลบ CSS `label.btn` ที่ตายแล้ว. ไม่กระทบการแสดงผล/sync แมพ
  (`state.mapBg` + `EMBEDDED_MAPS` เหมือนเดิม).

## [2026.06.09.2]
### Added
- **แผนเกิดบน/เกิดล่าง — แมพ Guild League เป็น 4 การ์ด.** GL สปอว์นได้ทั้งฝั่งบน/ล่าง เลยต้องวาง 2 แผน.
  เพิ่มการ์ด Main+Sub อีกชุด (mapNum 4/5, "เกิดล่าง") ใช้ **ทีมชุดเดิม + รูปแมพเดิม** แต่มีหมุด/ลูกศรแยกของ
  ตัวเอง: `state.markersBottom` sync ผ่าน Firebase node ใหม่ `markers_bottom` (ทำตาม pattern `overrun_markers`).
  หมุดเดิมกลายเป็นแผน "เกิดบน". วงระยะ/ฟิลเตอร์ตี้/สมาชิกในตี้ ใช้ร่วมกันทั้ง 2 แผน. การจัดตี้ (`commitPartiesNow`)
  ไม่กระทบ. helper `leagueMarkerStore/leagueMapIsMain/leagueMapPlan` เลือก store/range ตาม mapNum.

## [2026.06.09.1]
### Fixed
- **ชื่อที่จัดเข้าตี้ "เด้ง"/หายเอง (เงียบๆ ไม่มี toast/audit).** จัดตี้ไว้ เข้าออกหลายรอบก็อยู่ แต่บางทีเปิด
  เข้ามาแล้วชื่อหายเอง. ต้นเหตุ: auto-sanitize ตัด slot ที่ `findMember(id)` หาไม่เจอ (`!m`) แล้ว **`.set()`
  เขียนทับ Firebase ถาวร** โดยไม่มี guard รอ `/parties` snapshot จริง — พอ members listener ชนะ race จะ
  sanitize ทับ parties จาก localStorage (ที่อ้าง member ที่ถูกลบไปแล้ว) ลบ slot ที่ valid แล้วเซฟทับ เงียบๆ
  (ไม่มี toast, ไม่ลง audit เพราะ sanitize write-back ไม่เรียก `logAudit`). **แก้ A:** auto-sanitize เป็น
  display-only ไม่ `.set()` กลับ Firebase อีก — ล้าง orphan ถาวรผ่านปุ่ม `repairGhostSlots()` (admin กดเอง).
  **แก้ B:** เพิ่ม `_fbPartiesLeagueLoaded`/`_fbPartiesOverrunLoaded` กั้นไม่ให้ members-listener sanitize
  ก่อน snapshot จริงของ `/parties` โหลด. การจัดตี้ปกติ (`commitPartiesNow`) ไม่กระทบ.

## [2026.06.08.1]
### Added
- **Audit log: บันทึกว่า "ใครแก้ทีม".** เดิมข้อมูลมีแค่ `updatedAt` (เวลา) แต่ไม่มี "ใคร" →
  เวลาทีม (เช่น Overrun วันอาทิตย์) โดนเปลี่ยน เราชี้ตัวคนทำไม่ได้. ตอนนี้ทุกครั้งที่ **แอดมิน
  แก้ทีม** (ลาก/วาง, sort, เปลี่ยนชื่อตี้, ลบจาก slot) ระบบบันทึก `{เวลา, อีเมลคนแก้, ทีม League/Overrun}`
  ลง Firebase node `/system/auditLog` แล้วโชว์ใน **กล่อง Login → "📜 ประวัติการแก้ทีม"** (อ่านอย่างเดียว,
  เห็นเฉพาะแอดมิน). บันทึกที่ **จุดแก้จริง (`commitPartiesNow`)** ซึ่งเป็น path เดียวของการแก้ทีม → ไม่พลาด
  และไม่โทษผิดคน; รู้กระดานจาก `state.mode`. แอดมินคนเดิมแก้กระดานเดิมรัวๆ ภายใน `AUDIT_COALESCE_MS`
  (=60s) จะ **ยุบเป็นแถวเดียว (×จำนวน)** ให้อ่านง่าย; เก็บสูงสุด `AUDIT_LOG_MAX`=50 (ตัดทั้งตอนเขียนและตอนอ่าน).
  **เก็บ log ใต้ `/system` ที่เป็น admin-write อยู่แล้ว → ไม่ต้องแก้ `database.rules.json`.** ข้อจำกัด:
  logAudit เขียนทับทั้ง array (read-modify-write) แอดมิน 2 คนแก้พร้อมกันเป๊ะอาจตกหล่น 1 entry — ยอมรับได้
  สำหรับกิลด์เดียวที่เชื่อใจกัน (โมเดลคือหัวหน้าแก้ คนอื่นดู). +4 เทสต์กลุ่ม `[audit log]` (cap / ยุบ burst /
  ไม่ยุบข้าม actor·action·เวลา / ทน log ที่ไม่ใช่ array).

## [2026.05.30.16]
### Changed
- **ฟิลเตอร์แผนที่เลือกได้หลายตี้พร้อมกัน (multi-select).** เดิม dropdown เลือกโฟกัสได้
  ทีละตี้ ตอนนี้เปลี่ยนเป็นแถว **ชิปติ๊ก** — กดเลขตี้หลายตัวเพื่อดูพร้อมกัน (เช่น ตี้ 4 + 5
  บนแผนที่ GL Main), ชิปที่เลือกติดสีตามทีม. ปุ่ม "🔍 ทุกตี้/ทุกกลุ่ม" ล้างเพื่อแสดงทุกตี้.
  ใช้ได้ทั้ง Main / Sub / Overrun แยกอิสระต่อแผนที่. เป็นมุมมองส่วนตัวของแต่ละคน
  (ไม่ sync, รีเซ็ตเมื่อ refresh) — ไม่ต้องแก้ Firebase rule. `_mapFilter*` เปลี่ยนจากเลขเดียว
  เป็น `Set` (ว่าง = ทุกตี้); helper `mapFilterVisible`/`_toggleInSet`. +5 เทสต์กลุ่ม
  `[map filter]` + css coverage.

## [2026.05.30.15]
### Added
- **วงกลมมาร์กระยะบนแผนที่ GL สนามหลัก.** เพิ่ม 3 วงระยะ (zone) วางบนจุดสี่เหลี่ยม
  กลาง/ซ้าย/ขวาของแผนที่ GL Main — มีปุ่ม "◯ ระยะ" บนหัวแผนที่เปิด/ปิดได้ (ค่าเริ่มต้นปิด).
  แอดมินลากจุดกลางเพื่อย้าย และลากจุดขอบเพื่อปรับรัศมีได้ (สมาชิกทั่วไปเห็นวงแบบอ่านอย่างเดียว
  ลากไม่ได้). ตำแหน่ง/รัศมี sync ทั้งกิลด์เรียลไทม์ผ่าน Firebase node ใหม่ `range_circles`
  (เก็บเป็น array 3 วง `{x,y,r}` หน่วยเป็น % ของแผนที่) + ปุ่ม "↺ รีเซ็ตวงระยะ" คืนค่าเริ่มต้น.
  อยู่เฉพาะแผนที่ GL Main (ไม่มีในสนามรอง/Overrun). `clampRangeCircle`/`initRangeCircles`
  กันค่าเพี้ยน (x,y 0–100, r 2–60) + เทสต์กลุ่ม `[range circles]` 6 ตัว + css coverage.
### Notes
- **ต้อง deploy Firebase rules ใหม่ด้วยตนเอง** — เพิ่ม node `range_circles` (อ่านได้ทุกคน
  เขียนได้เฉพาะแอดมิน) ใน `database.rules.json` ถ้ายังไม่ deploy การเขียนวงจะถูกปฏิเสธ
  (วงจะใช้ดูในเครื่องได้ แต่ไม่ sync ข้ามคน).

## [2026.05.30.14]
### Changed
- **ย้ายชื่อ repo → `one-o-clock-woe` (ลิงก์ใหม่).** เว็บย้ายจาก
  `cybodies.github.io/woe-party` ไป `cybodies.github.io/one-o-clock-woe` (ลิงก์เก่า GitHub
  redirect ให้อัตโนมัติ). อัปเดต URL ที่ฝังในโค้ด: `index.html` (og:url, og:image, ลิงก์
  GitHub footer) + เอกสาร (CLAUDE.md, RUNBOOK.md, woe-coder agent). git remote ชี้ repo
  ใหม่แล้ว. **Firebase project (`woe-party-default-rtdb`) ไม่เปลี่ยน** — เป็นคนละระบบ
  ข้อมูลกิลด์ทั้งหมดตามมาครบ ไม่หาย. โค้ดยัง public ตามเดิม.

## [2026.05.30.13]
### Fixed
- **ทำให้ fix v.12 (ช่องค้นหาสมาชิกเด้งขึ้นบน) สมบูรณ์.** v.12 ใส่บรรทัด "เก็บค่า
  `scrollTop`" ลงไป แต่บรรทัด "คืนค่า" ดัน apply ไม่ติด (anchor ไม่ตรง) — เลยเก็บแต่ไม่คืน
  รายชื่อจึงยังเด้งขึ้นบนเหมือนเดิม. v.13 เพิ่มบรรทัดคืนค่า `list.scrollTop = _mlScrollTop`
  หลัง re-render ครบถ้วน + เทสต์ `[search box scroll-jump guard]` เช็คลำดับ capture → innerHTML
  → restore แล้ว (ตอนนี้ผ่าน). _หมายเหตุ: v.12 ที่ขึ้นไปก่อนหน้ามีเทสต์แดง 1 ตัว — ผิดพลาด
  ของผมเองที่ push ทั้งที่ยังไม่เขียว v.13 แก้ให้เรียบร้อย._

## [2026.05.30.12]
### Fixed
- **ช่องค้นหารายชื่อสมาชิก (sidebar) ไม่เด้งขึ้นบนแล้วตอนพิมพ์.** `renderMembers` เขียน
  `#memberList.innerHTML` ใหม่ทุกตัวอักษรที่พิมพ์ ซึ่ง reset `scrollTop` ของ `.member-list`
  (เป็น scroll container เดียวของ pool) กลับเป็น 0 → รายชื่อเด้งขึ้นบนสุด. แก้โดยเก็บ
  `scrollTop` ก่อน re-render แล้วคืนค่าหลัง (ช่อง input เป็น sibling ไม่ถูกสร้างใหม่
  focus/caret จึงอยู่ครบอยู่แล้ว). คนละจุดกับ fix v.7 ที่แก้ `auctionSearchInput` (ช่อง
  ค้นหาในหน้าประมูล) — อันนั้นคนละช่องกัน. +2 เทสต์ใน `[search box scroll-jump guard]`
  (รวม 82).

## [2026.05.30.11]
### Changed
- **ขอประมูลได้ 1 คน 1 อย่าง ต่อกิจ.** เดิมสมาชิกติ๊กขอได้หลายชนิดในคำขอเดียว ตอนนี้
  จำกัดให้ขอได้ **1 ชนิดต่อกิจ** (การ์ด/Illusion/ขนขาว/ขนดำ — เลือกอย่างเดียว) — modal
  เปลี่ยนเป็น single-select (ปุ่มวงกลม ◉/○). ถ้ามีคำขอค้างอยู่แล้ว (รออนุมัติ/อนุมัติแล้ว)
  ปุ่ม "ขอประมูล" จะล็อกเป็น "✅ ขอแล้ว 1 อย่าง" — ต้อง **ถอนของเก่าก่อน** ถึงจะขอใหม่ได้
  (คำขอที่ถูกปฏิเสธ/ถอนแล้ว ไม่นับ — ขอใหม่ได้เลย). บังคับใช้ทั้งฝั่ง UI และตอนสร้างคำขอ
  ผ่าน `arActiveRequestFor` (แหล่งความจริงเดียว); `arCreateRequest` คืน `true` เมื่อสำเร็จ
  เพื่อให้ modal ปิดถูกต้อง. +6 เทสต์ (รวม 79).

## [2026.05.30.10]
### Added
- **ประวัติคำขอที่ถูกปฏิเสธ (same-day).** หน้า ขอประมูล ฝั่งแอดมินมี section ใหม่
  "❌ ปฏิเสธวันนี้" แสดงคำขอที่กดปฏิเสธไป (พร้อมเหตุผล) ค้างไว้ให้ดูตลอดวัน — แอดมิน
  เห็นว่าใครโดนปฏิเสธและกด "✓ อนุมัติ" ย้อนได้ถ้าปฏิเสธพลาด ประวัตินี้ถูกล้างพร้อม
  ทั้งวันโดย "ล้างคำขอทั้งหมดของวันนี้" / ล้างวันที่ผ่านมา / รีเซ็ตรายวัน (ขอบเขตวันเดียว
  เหมือนข้อมูลประมูลอื่น). (`arBuildAdminQueue` ดึง `rejected` เพิ่ม; `arRenderRow` ปุ่ม
  re-approve สำหรับ rejected row.)

## [2026.05.30.9]
### Changed
- **Auction page-map now packs items CONTINUOUSLY instead of starting each item type on a
  fresh page.** The next item type begins right after the previous one's last slot on the
  same page — e.g. การ์ด fills page 1, Illusion takes page 2 slots 1-2, then ขนขาว starts on
  **page 2 slot 3** (not a fresh page 3). For Overrun with การ์ด 20 + Illusion 2, ขนขาว now
  starts **page 6 slot 3**. This reverses the per-type fresh-page rule from 2026.05.30.3 to
  match the in-game auction's actual behavior. One shared code path fixes GL + Overrun; the
  per-column page chip, the top page-map strip, and the per-person page badges all follow.

## [2026.05.30.8]
### Fixed
- **Per-column page chip shows the exact slot range, not just the page.** A partial page
  read ambiguously (2 items on page 6 showed “หน้า 6 · 2 ชิ้น”, looking like the whole page).
  It now reads “หน้า 6 · ชิ้น 1-2 · รวม 2 ชิ้น” (and “หน้า X (ช่อง a)–Y (ช่อง b)” when it spans
  pages), matching the per-person badges below it.

## [2026.05.30.7]
### Fixed
- **Auction search box no longer jumps to the top while typing.** `auctionSearchInput`
  restored focus/scroll in a `setTimeout`, so the page painted at the top for one frame
  (the jump) before snapping back. It now restores focus + caret + scroll synchronously
  right after the re-render — the same proven pattern as `setAuctionField`/`setAuctionRate`.
- **GL split % input now matches the dark/gold theme.** Its CSS (`.auction-split-input`
  + related) had silently failed to land, so it rendered as a plain white box. Added the
  themed styles plus a `[css coverage]` test group that fails if a themed control's class
  is in the markup but has no matching CSS rule.

## [2026.05.30.6]
### Fixed
- **Admin "จัดสรรอัตโนมัติ" buttons now follow the day's event.** On the ขอประมูล admin
  queue, only the current event's allocate button shows — GL on อังคาร/พฤหัส, Overrun on
  อาทิตย์, and **neither** on a non-event day (previously both GL + Overrun always showed).
  Matches the event-day lock already enforced on the guest request side. "🧹 ล้างวันที่
  ผ่านมา" stays available regardless. (`arBuildAdminQueue` now takes `eventMode`.)
### Added
- **`woe-feature-map` skill** — a pre-edit checklist that traces every surface a feature
  touches (guest/admin/viewer render, GL/Overrun branches, state+sync, the gate on all
  actors, tests) so a cross-cutting rule can't be applied to one surface and missed on its
  twin (the bug above is its worked example).

## [2026.05.30.5]
### Added
- **Editable สนามหลัก/สนามรอง split % for the GL auction.** Admins can set what
  percent of each item goes to สนามหลัก (default 70); สนามรอง gets the rest. New
  "⚖️ การแบ่งสนาม" control on the Auction GL page; all field labels (headers, per-column
  ใช้/XX%, summary) follow the value live. The split rides the existing `auction_gl`
  Firebase object (no rule change). Overrun is unaffected (no sub field).
### Changed
- **Uneven split now rounds the leftover to สนามหลัก (ceil), not down.** When an item
  count doesn't divide cleanly, the extra piece is auctioned on the main field — e.g. 5
  ชิ้น @70% = หลัก 4 / รอง 1 (previously 3/2). Whole splits (e.g. 10 @70% = 7/3) are
  unchanged, as are the supply page-map's per-type page ranges (they derive from each
  item's total, not the main/sub split).

## [2026.05.30.4]
### Added
- **Branded landing page (front door).** A new static `index.html` is now the front
  page — the "one o clock — Ragnarok Origin Classic" logo, a feature overview, the weekly
  event schedule (อังคาร/พฤหัส = GL · อาทิตย์ = Overrun, today highlighted), and a CTA into
  the tool. Open Graph tags make shared links preview the logo (Discord/LINE). Logo at
  `assets/one-o-clock.png`.
### Changed
- **The app moved from `index.html` to `app.html`** so the landing can own the root URL.
  GitHub Pages now serves the landing at `/` and the organizer at `/app.html`. Weekly users
  can bookmark `/app.html` to skip the intro. Test harness + parse check follow the rename;
  a `[landing]` test group guards the front-door wiring.

## [2026.05.30.3]
### Fixed
- **Auction page-map — each item type now starts on its own fresh page** (matches
  the in-game auction, where every item type begins on a new page). Previously a
  type continued mid-page from the previous type (e.g. ขนขาว shared a page with
  Illusion), so the page numbers didn't line up with the real auction. Now: การ์ด 4
  → all page 1; การ์ด 6 → p1–2; the next type starts fresh. Within a type, main → sub
  still run continuously. Applies to GL and Overrun (fixes Overrun types overlapping
  on page 1). Per-person page badges + the per-column page chip follow the same blocks.
### Added
- **Per-column coverage line** on each auction column — "ลากถึงหน้า N · ขาดอีก X ชิ้น
  (Y หน้า)" / "✅ ลากครบ" / "เกินมา" — so the admin can fill people to match the real
  pages without counting.

## [2026.05.30.2]
### Added
- **Auction page-map (supply-based):** each Auction GL/Overrun page now shows the
  real in-game auction pages computed from the **item pool** — a top ruler
  ("วันนี้รวม N ชิ้น = M หน้า" + page span per item type) and a "📄 หน้า X–Y" chip on
  each column. Per-person page badges are re-anchored to the pool, so a dragged
  person's page matches the real auction even when other columns aren't filled.
  Page numbers depend on item counts only (rate-independent). GL is one continuous
  run (sub continues main's partial page); Overrun is independent per item type.
- **SDLC hardening (Phase 1):** versioned Firebase security rules
  (`database.rules.json` + `docs/firebase-rules-audit.md`), GitHub Actions CI running the
  test suite on push/PR, this changelog, a `RUNBOOK.md`, and a version stamp in the app
  footer.
- **Auction Request — event-day lock:** the ขอประมูล page now opens only on the current
  event day (อังคาร/พฤหัส = GL, อาทิตย์ = Overrun) and only for that day's event; no
  requesting a future event in advance.
- **Editable per-person rates:** admins can set จำนวนของที่ได้รับต่อคน per item for both
  GL and Overrun auctions (synced; feeds the auction-page chain numbering).
- **Test suite + QA tooling:** dependency-free Node test harness (`test/`,
  `node test/run.js`), `/woe-qa` pre-deploy skill, and `woe-qa-reviewer` agent.

### Notes
- Firebase rules in this release must be **deployed manually** (console paste or
  `firebase deploy --only database`) — see `docs/firebase-rules-audit.md`. The new
  `rates` write requires these rules (or equivalent) to be live.
