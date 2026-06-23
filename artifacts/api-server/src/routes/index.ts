import { Router, type IRouter } from "express";
import healthRouter from "./health";
import questionsRouter from "./questions";
import sessionsRouter from "./sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(questionsRouter);
router.use(sessionsRouter);

export default router;
