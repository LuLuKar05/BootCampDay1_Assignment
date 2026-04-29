import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Hello world!" });
});

router.get("/:slug", (req: Request, res: Response) => {
  const { slug } = req.params;
  res.json({ message: `Hello ${slug}!` });
});

export default router;
