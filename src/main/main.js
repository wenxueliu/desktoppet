const { app } = require("electron");
const { registerIpc } = require("./ipc");
const { createPanelWindow, createPetWindow, getWindows } = require("./windows");

async function boot() {
  await createPetWindow();
  await createPanelWindow({ show: false });
  registerIpc({ getWindows });
}

app.whenReady().then(boot);

app.on("activate", async () => {
  const { pet } = getWindows();

  if (!pet || pet.isDestroyed()) {
    await createPetWindow();
  }
});
