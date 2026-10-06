# Modern interface: cinematic gold

Only `html[data-interface="modern"] .modern-shell` receives the new UI styles. Fantasy components, styles, save data and game rules are unchanged. Modern navigation has Hunt, World, Hero, Bag and More; Arena, Crafting and other existing sections remain in the More drawer. Hero equipment opens the bag; inventory retains comparison, equip, unequip, protection, sale and salvage actions.

Modern Hunt and World use `public/assets/modern/green-plains.webp` for Green Plains; other regions retain their respective landscapes. Existing transparent monster and full-body class assets are reused without altering fantasy artwork. The plains image was generated with the built-in imagegen tool, optimized to 1024×1024 WebP, and stored at that project path.

Generation prompt:

> Use case: stylized-concept. Asset type: production background for a mobile fantasy RPG modern UI, square 1024x1024. Create a cinematic photorealistic medieval green valley viewed from a shaded forest hillside: massive old trees and dark leafy branches framing top and left edges, detailed mossy rocks foreground bottom, sunlit lake and rolling green plains middle distance, spectacular stone medieval castle on cliff on upper right, jagged alpine mountains and blue clouded sky. Realistic AAA game art, richly textured natural foliage, warm late afternoon light, deep forest greens and gold light. Composition center-left area open to composite a large monster sprite; castle visible in upper right, bottom softly dark for overlaid white titles. No characters, animals, text, UI, buttons, borders or watermark.

Validation: TypeScript and production build; full existing test suite plus modern theme navigation, monster browsing without energy charges, inventory protection/equipment and drawer Escape/focus restoration. Browser screenshots were unavailable because the environment could not download Chromium; final visual inspection on a real Telegram mobile client remains pending.
