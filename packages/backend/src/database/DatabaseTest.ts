import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Layer } from "effect";
import * as HomeDirectory from "../platform/HomeDirectory.js";
import * as Database from "./Database.js";

export const makeDatabaseTestLayer = (homeDirectory: string) =>
  Database.layer.pipe(
    Layer.provide(
      Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, HomeDirectory.makeLayer(homeDirectory)),
    ),
  );
