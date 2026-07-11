type NamedItem = {
  readonly id: string;
  readonly number: string;
  readonly color: string;
  readonly name?: string | undefined;
  readonly updatedAt: unknown;
};

type NamedItemEdit<Item extends NamedItem> = {
  readonly id: Item["id"];
  readonly number: Item["number"];
  readonly color: Item["color"];
  readonly name?: string | undefined;
};

export const applyOptimisticNamedItemEdit = <Item extends NamedItem>(
  item: Item,
  edit: NamedItemEdit<Item>,
  updatedAt: Item["updatedAt"],
): Item => {
  if (item.id !== edit.id) return item;
  const name = edit.name?.trim();
  return {
    ...item,
    number: edit.number,
    color: edit.color,
    updatedAt,
    ...(edit.name === undefined ? {} : name ? { name } : { name: undefined }),
  };
};
