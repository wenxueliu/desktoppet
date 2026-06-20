const { app } = require("electron");
const { createPanelWindow, createPetWindow, getWindows } = require("./windows");

async function boot() {
  await createPetWindow();
  await createPanelWindow({ show: false });
}

app.whenReady().then(boot);

app.on("activate", async () => {
  const { pet } = getWindows();

  if (!pet || pet.isDestroyed()) {
    await createPetWindow();
  }
});
