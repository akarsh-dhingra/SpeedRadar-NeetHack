import React from "react";
import { Composition } from "remotion";
import { Film } from "./Film";
import { tl } from "./tl";
import { FPS, H, W } from "./theme";

export const Root: React.FC = () => (
  <Composition id="Film" component={Film} durationInFrames={Math.ceil(tl.duration * FPS)} fps={FPS} width={W} height={H} />
);
