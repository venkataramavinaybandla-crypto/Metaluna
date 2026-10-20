# Metaluna — Image Studio

A single-page image studio. No build step: open `index.html` in a browser.
Describe the image you want, then pick one to four images and a ratio: 1:1, 4:3, 3:4, 16:9 or 9:16.
Frames are requested one at a time, so every image appears the moment it is ready.
The studio estimates about 1:20 per image and shows elapsed time while it works.
Name the set to unlock downloads: `Name-1.png`, `Name-2.png`, numbered in display order.
Spaces become underscores, and `/ \ : * ? " < > |` are stripped from file names.
Download images individually, or pack the whole set into `Name.zip`.
Click an image for the fullscreen viewer; Esc closes it, arrow keys move through the set.
The header pill polls the backend and, when it is asleep, offers a wake link to your Colab notebook.
Backend URL and notebook link live in the settings drawer and are saved in this browser.
