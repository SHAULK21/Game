# TikTok №6 — озвучка Audio8 TTS

- Модель: Audio8-TTS-Realistic-Air (0.6B, Apache 2.0), https://github.com/Edge0-AI/Audio8_TTS, веса с Hugging Face `Edge0/Audio8-TTS-Realistic-Air`.
- Запуск на CPU: `gen.sh` (первая фраза задаёт голос без образца, остальные клонируют его). ~35–40 с на фразу.
- Текст фраз — `lines.json` (≤150 символов на фразу; «Телеграм», «Премиум» — кириллицей, чтобы модель читала правильно).
- Фразы `create` и `chars` перегенерированы с тем же голосом (образец — первая версия `create`), сиды 21 и 33.
- Проверка: распознавание Whisper-small — текст совпадает.
- Запись сцен: `../tt8.mjs`, сборка: `../tt8_build.py media/tiktok-6-voice.mp4`.
