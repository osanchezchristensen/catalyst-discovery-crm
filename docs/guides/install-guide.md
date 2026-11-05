# Install Catalyst Discovery CRM

Catalyst Discovery CRM is a desktop app for planning, logging and learning from customer interviews. There's no account to create, and nothing you type leaves your computer.

This is a **beta (0.9)** for the first Catalyst cohort. The installer isn't signed by KU yet, so your computer will warn you the first time you open it. The steps below show exactly what to click.

## 1. Download

Go to **[the Releases page](https://github.com/osanchezchristensen/catalyst-discovery-crm/releases/latest)** and download the file for your computer:

| Your computer | File to download |
| --- | --- |
| Windows 10 or 11 | the file ending in **`.exe`** |
| Mac (Intel or Apple silicon) | the file ending in **`.dmg`** |
| Linux (Ubuntu 22.04 or later) | the file ending in **`.AppImage`** |

## 2. Install

### Windows

1. Open the `.exe` file you downloaded.
2. If a blue **"Windows protected your PC"** box appears, click **More info**, then **Run anyway**. Windows shows this for any app that isn't signed yet.
3. Follow the installer. You don't need an administrator password. It installs just for you.
4. Open **Catalyst Discovery CRM** from the Start menu or the desktop shortcut.

### Mac

1. Open the `.dmg` file and drag **Catalyst Discovery CRM** into **Applications**.
2. The first time, **right-click** (or Control-click) the app in Applications and choose **Open**, then click **Open** again.
3. If your Mac says the app "can't be opened", open **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to Catalyst Discovery CRM.
4. After the first time, open it like any other app.

### Linux

1. Make the file runnable: right-click it → **Properties** → **Permissions** → allow executing as a program. Or run `chmod +x Catalyst-Discovery-CRM-*.AppImage` in a terminal.
2. Double-click it to start.

## 3. First launch

Type your name, pick your Catalyst stage, and name your venture. A working name is fine. If a teammate sent you a workspace file, choose **Import workspace** instead.

## Where your data lives

Everything is saved in one file on your computer:

- **Windows:** `%APPDATA%\Catalyst Discovery CRM`
- **Mac:** `~/Library/Application Support/Catalyst Discovery CRM`
- **Linux:** `~/.config/Catalyst Discovery CRM`

**Settings → Open data folder** takes you there.

**Backups** happen by themselves when the app opens and once a day. The app keeps one a day for the last 14 days. **Settings → Back up now** makes an extra one any time.

## Moving to another computer, or working with teammates

1. On the old computer: **Settings → Export workspace**. This saves one `.json` file.
2. Copy that file to the new computer (email, USB drive or KU Box).
3. Install the app there and choose **Import workspace** on the Welcome screen.

Teammates can send each other exports the same way. The app shows what will change before it imports anything. Contact emails and phone numbers are left out of exports unless you tick the box in Settings. Attachments (photos, recordings) stay on the computer they were added on.

## Updating

Download the newer installer from the Releases page and run it. Your data stays where it is.

## Uninstalling

- **Windows:** Settings → Apps → Catalyst Discovery CRM → Uninstall.
- **Mac:** drag the app from Applications to the Trash.
- **Linux:** delete the `.AppImage` file.

Uninstalling **keeps your data folder**, so you don't lose interviews by accident. To remove your data too, delete the data folder listed above. Export a workspace first if you might want it later.

## Something went wrong?

If the app says it **could not open your data**, the message names your newest backup. Choose **Open data folder** and follow the steps in the message, or bring the message to your program staff.
