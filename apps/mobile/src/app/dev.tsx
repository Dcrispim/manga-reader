import * as BackgroundTask from "expo-background-task";
import { desc, eq } from "drizzle-orm";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { db } from "../db/client";
import { diagLog, jobs } from "../db/schema";
import { enqueueAndDrain } from "../jobs/drain";

// Development-only screen: lets the background task and the queue be driven by
// hand on the emulator. Not reachable in release builds.
export default function DevScreen() {
  const [title, setTitle] = useState("");
  const [chapter, setChapter] = useState("");
  const [out, setOut] = useState("");

  const refresh = () => {
    const cycles = db
      .select()
      .from(diagLog)
      .where(eq(diagLog.scope, "cycle"))
      .orderBy(desc(diagLog.id))
      .limit(5)
      .all();
    const all = db.select().from(jobs).all();
    setOut(
      [
        ...cycles.map((c) => `cycle: ${c.message}`),
        ...all.map((j) => `job ${j.id} ${j.kind} ${j.title}/${j.chapter} ${j.state} ${j.pagesDone}/${j.pagesTotal}`),
      ].join("\n"),
    );
  };

  if (!__DEV__) return null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <TextInput
        placeholder="Título"
        value={title}
        onChangeText={setTitle}
        style={{ borderWidth: 1, padding: 8 }}
      />
      <TextInput
        placeholder="Capítulo"
        value={chapter}
        onChangeText={setChapter}
        style={{ borderWidth: 1, padding: 8 }}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          enqueueAndDrain(db, "download", title, chapter);
          refresh();
        }}
      >
        <Text>Enfileirar download de teste</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => void BackgroundTask.triggerTaskWorkerForTestingAsync().then(refresh)}
      >
        <Text>Disparar tarefa de background</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={refresh}>
        <Text>Atualizar</Text>
      </Pressable>
      <View>
        <Text selectable>{out}</Text>
      </View>
    </ScrollView>
  );
}
