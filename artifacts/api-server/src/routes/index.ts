import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth.js";
import savesRouter from "./saves.js";
import leaderboardRouter from "./leaderboard.js";
import playersRouter from "./players.js";
import digimonsRouter from "./digimons.js";
import overridesRouter from "./overrides.js";
import itemsRouter from "./items.js";
import mapsRouter from "./maps.js";
import friendsRouter from "./friends.js";
import configRouter from "./config.js";
import tamersRouter from "./tamers.js";
import chatRouter from "./chat.js";
import namingToolRouter from "./naming-tool.js";
import saveMapRouter from "./save-map.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/saves", savesRouter);
router.use("/leaderboard", leaderboardRouter);
router.use("/players", playersRouter);
router.use("/digimons", digimonsRouter);
router.use("/overrides", overridesRouter);
router.use("/items", itemsRouter);
router.use("/maps", mapsRouter);
router.use("/friends", friendsRouter);
router.use("/config", configRouter);
router.use("/tamers", tamersRouter);
router.use("/chat", chatRouter);
router.use("/naming-tool", namingToolRouter);
router.use("/save-map", saveMapRouter);

export default router;
