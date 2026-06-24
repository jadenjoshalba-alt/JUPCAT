import { Router, type IRouter } from "express";
import healthRouter from "./health";
import questionsRouter from "./questions";
import sessionsRouter from "./sessions";
import imagesRouter from "./images";

const router: IRouter = Router();

router.use(healthRouter);
router.use(questionsRouter);
router.use(sessionsRouter);
router.use(imagesRouter);

export default router;
