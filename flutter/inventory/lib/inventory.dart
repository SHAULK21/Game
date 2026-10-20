import 'package:flutter/material.dart';

typedef InventoryAction = Future<Map<String, dynamic>> Function(Map<String, dynamic>);
typedef Item = Map<String, dynamic>;
List<Item> rows(dynamic value) => (value as List? ?? []).map((e) => Map<String, dynamic>.from(e)).toList();
int number(dynamic value) => value is num ? value.toInt() : 0;
Color rarityColor(Item item) => Color(int.parse('ff${item['color'] ?? '94a3b8'}', radix: 16));
const ink = Color(0xffe5e7eb), muted = Color(0xff9aa7b8), gold = Color(0xffdfbd7f), panel = Color(0xff16212e);

class InventoryApp extends StatelessWidget {
  const InventoryApp({super.key, required this.data, required this.onAction});
  final Item data;
  final InventoryAction onAction;
  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: ThemeData(brightness: Brightness.dark, fontFamily: 'InventorySans', fontFamilyFallback: const ['InventorySymbols'], scaffoldBackgroundColor: const Color(0xff0c141e),
      colorScheme: ColorScheme.fromSeed(seedColor: gold, brightness: Brightness.dark), useMaterial3: true,
      inputDecorationTheme: const InputDecorationTheme(filled: true, fillColor: panel, border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(12)))),
      cardTheme: const CardThemeData(color: panel, margin: EdgeInsets.zero)),
    home: InventoryPage(data: data, onAction: onAction),
  );
}

class InventoryPage extends StatefulWidget {
  const InventoryPage({super.key, required this.data, required this.onAction});
  final Item data;
  final InventoryAction onAction;
  @override
  State<InventoryPage> createState() => _InventoryPageState();
}
class _InventoryPageState extends State<InventoryPage> {
  String category = 'equipment', query = '', sort = 'power';
  String? selectedId;
  bool busy = false;
  String feedback = '';
  String s(String key) => (widget.data['labels'] as Map? ?? {})[key]?.toString() ?? key;
  List<Item> get equipped => rows(widget.data['equipped']);
  List<Item> get bag => rows(widget.data['items']);
  bool get canAct => widget.data['canAct'] == true;
  Item? findItem(String? id) {for (final i in [...bag, ...equipped]) {if (i['id'] == id) return i;} return null;}
  Future<void> act(String type, {String? id, Item? extra}) async {
    if (busy) return;
    setState(() {busy = true; feedback = '';});
    try {
      final result = await widget.onAction({'owner': widget.data['owner'], 'type': type, if (id != null) 'id': id, ...?extra});
      if (!mounted) return;
      setState(() {
        feedback = s(result['message']?.toString().isNotEmpty == true ? result['message'].toString() : 'Готово.');
        if (result['success'] != false && ['equip','unequip','sell','disassemble'].contains(type)) selectedId = null;
      });
    } catch (_) {if (mounted) setState(() {feedback = s('Не удалось выполнить действие.');});}
    finally {if (mounted) setState(() {busy = false;});}
  }
  Future<bool> confirm(String title, String text) async => await showDialog<bool>(context: context, builder: (c) => AlertDialog(
    title: Text(title), content: SingleChildScrollView(child: Text(text)), actions: [
      TextButton(onPressed: () => Navigator.pop(c, false), child: Text(s('Отмена'))),
      FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(s('Подтвердить'))),
    ])) ?? false;

  @override
  Widget build(BuildContext context) {
    if (widget.data.isEmpty) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final all = bag.where((i) => category == 'equipment' ? i['equipment'] == true : category == 'potions' ? i['type'] == 'potion' : ['ore','material'].contains(i['type'])).toList();
    final visible = all.where((i) => '${i['name']} ${i['typeLabel']} ${i['rarityLabel']}'.toLowerCase().contains(query.toLowerCase())).toList();
    final rarities = rows(widget.data['rarities']).map((e) => e['id']).toList();
    visible.sort((a,b) => sort == 'name' ? '${a['name']}'.compareTo('${b['name']}') : sort == 'rarity' ? rarities.indexOf(b['rarity']).compareTo(rarities.indexOf(a['rarity'])) : number(b['score']).compareTo(number(a['score'])));
    final selected = findItem(selectedId);
    return Scaffold(body: Stack(children: [
      CustomScrollView(key: const PageStorageKey('inventory-scroll'), slivers: [SliverPadding(padding: const EdgeInsets.fromLTRB(14,16,14,12), sliver: SliverList.list(children: [
        Row(children: [const Icon(Icons.backpack_outlined, color: gold, size: 30), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(s('Сумка'), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: ink)),
          Text('${widget.data['name']} · ${s('Ур.')} ${widget.data['level']}', style: const TextStyle(color: muted, fontSize: 12)),
        ])), Text('${widget.data['used']} / ${widget.data['capacity']}', style: const TextStyle(color: gold, fontSize: 15))]),
        const SizedBox(height: 14),
        Wrap(spacing: 8, runSpacing: 8, children: [metric(Icons.toll, '${widget.data['gold']}', s('Золото')), metric(Icons.circle_outlined, '${widget.data['silver']}', s('Серебро')),
          OutlinedButton(onPressed: busy || !canAct ? null : () => act(widget.data['premium'] == true ? 'expand' : 'premium'), child: Text(widget.data['premium'] == true ? '+5 · ${widget.data['expansionCost']}' : s('Подключить Premium')))]),
        const SizedBox(height: 12),
        ExpansionTile(key: const PageStorageKey('equipment'), tilePadding: const EdgeInsets.symmetric(horizontal: 4), leading: const Icon(Icons.shield_outlined, color: gold), title: Text(s('Снаряжение')), subtitle: Text('${equipped.length} · ${s('Надето')}', style: const TextStyle(fontSize: 11, color: muted)), children: [
          Wrap(spacing: 6, runSpacing: 6, children: rows(widget.data['slots']).map((slot) {
            Item? item; for (final i in equipped) {if (i['type'] == slot['id']) item = i;}
            final current = item;
            return SizedBox(width: 92, child: InkWell(onTap: current == null ? null : () => setState(() {selectedId = current['id'];}), borderRadius: BorderRadius.circular(12), child: Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: panel, borderRadius: BorderRadius.circular(12), border: Border.all(color: current == null ? Colors.white12 : rarityColor(current).withValues(alpha: .5))), child: Column(children: [
              if (current == null) Icon(typeIcon('${slot['id']}'), color: Colors.white24, size: 36) else artwork(current, 36),
              const SizedBox(height: 5), Text('${slot['label']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, color: muted)),
              Text(current == null ? s('Пусто') : '+${current['upgrade']} · ◆${current['merge']}', style: const TextStyle(fontSize: 10, color: gold)),
            ]))));
          }).toList()), const SizedBox(height: 12),
        ]),
        if (!canAct) Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(s('Действия доступны в поселении.'), style: const TextStyle(color: gold, fontSize: 12))),
        const SizedBox(height: 8),
        Row(children: [('equipment','Снаряжение',Icons.shield_outlined),('potions','Зелья',Icons.science_outlined),('resources','Ресурсы',Icons.diamond_outlined)].map((tab) => Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 2), child: ChoiceChip(showCheckmark: false, selected: category == tab.$1, label: SizedBox(width: double.infinity, child: Column(children: [Icon(tab.$3, size: 18), Text(s(tab.$2), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11))])), onSelected: (_) => setState(() {category = tab.$1;}))))).toList()),
        const SizedBox(height: 12),
        TextField(key: const ValueKey('inventory-search'), onChanged: (v) => setState(() {query = v;}), decoration: InputDecoration(hintText: s('Поиск предмета'), prefixIcon: const Icon(Icons.search), isDense: true), style: const TextStyle(fontSize: 13)),
        const SizedBox(height: 8),
        Row(children: [Expanded(child: Text('${visible.length} · ${s('В сумке')}', style: const TextStyle(color: muted, fontSize: 12))), DropdownButton<String>(value: sort, underline: const SizedBox(), style: const TextStyle(color: muted, fontSize: 12), items: [('power','Сначала сильные'),('name','По имени'),('rarity','По редкости')].map((v) => DropdownMenuItem(value: v.$1, child: Text(s(v.$2)))).toList(), onChanged: (v) => setState(() {sort = v!;}))]),
      ])),
        if (visible.isEmpty) SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.all(32), child: Center(child: Text(s('Ничего не найдено'), style: const TextStyle(color: muted)))))
        else SliverPadding(padding: const EdgeInsets.symmetric(horizontal: 14), sliver: SliverLayoutBuilder(builder: (context, constraints) => SliverGrid.builder(
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: constraints.crossAxisExtent < 340 ? 3 : constraints.crossAxisExtent > 620 ? 5 : 4, mainAxisExtent: 136, crossAxisSpacing: 7, mainAxisSpacing: 7), itemCount: visible.length, itemBuilder: (_, index) => itemCard(visible[index])))),
        SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.fromLTRB(14,18,14,24), child: Column(children: [
          OutlinedButton.icon(onPressed: busy || !canAct ? null : showBulk, icon: const Icon(Icons.inventory_2_outlined), label: Text(s('Массовая продажа и разбор'))),
          const SizedBox(height: 8), Row(children: [Expanded(child: TextButton.icon(onPressed: busy ? null : () => act('blacksmith'), icon: const Icon(Icons.handyman_outlined), label: Text(s('Кузница')))), Expanded(child: TextButton.icon(onPressed: busy ? null : () => act('crafting'), icon: const Icon(Icons.construction), label: Text(s('Создание'))))]),
        ]))),
      ]),
      if (selected != null) Positioned.fill(child: BlockSemantics(child: ColoredBox(color: const Color(0xff0c141e), child: SafeArea(child: details(selected))))),
      if (feedback.isNotEmpty) Positioned(left: 12, right: 12, bottom: 10, child: Material(color: const Color(0xff283744), elevation: 8, borderRadius: BorderRadius.circular(12), child: Padding(padding: const EdgeInsets.fromLTRB(12,4,2,4), child: Row(children: [Expanded(child: Text(feedback, style: const TextStyle(fontSize: 12))), IconButton(onPressed: () => setState(() {feedback = '';}), icon: const Icon(Icons.close, size: 18), tooltip: s('Закрыть'))])))),
      if (busy) const Positioned(left: 0, right: 0, top: 0, child: LinearProgressIndicator(minHeight: 3)),
    ]));
  }
  Widget metric(IconData icon, String value, String label) => Semantics(label: '$label $value', child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10), decoration: BoxDecoration(color: panel, borderRadius: BorderRadius.circular(10)), child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, color: gold, size: 16), const SizedBox(width: 6), Text(value, style: const TextStyle(color: ink, fontSize: 12))])));
  Widget artwork(Item item, double size) => item['image'] == null ? Icon(typeIcon('${item['type']}'), size: size, color: rarityColor(item)) : Image.network('${item['image']}', width: size, height: size, fit: BoxFit.contain, excludeFromSemantics: true, errorBuilder: (_, _, _) => Icon(typeIcon('${item['type']}'), size: size, color: rarityColor(item)));
  Widget itemCard(Item item) => Semantics(button: true, label: '${item['name']}, ${item['rarityLabel']}, +${item['upgrade']}, ◆${item['merge']}', child: InkWell(key: ValueKey('item-${item['id']}'), onTap: busy ? null : () => setState(() {selectedId = item['id']; feedback = '';}), borderRadius: BorderRadius.circular(12), child: Container(padding: const EdgeInsets.all(7), decoration: BoxDecoration(color: panel, borderRadius: BorderRadius.circular(12), border: Border.all(color: rarityColor(item).withValues(alpha: .5))), child: Column(children: [
    Row(children: [Text('${item['level']}', style: const TextStyle(color: muted, fontSize: 10)), const Spacer(), if (item['locked'] == true || item['bound'] == true) const Icon(Icons.lock_outline, size: 13, color: gold)]),
    artwork(item, 38), const SizedBox(height: 5), Expanded(child: Text('${item['name']}', maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: TextStyle(color: rarityColor(item), fontSize: 10, height: 1.2))),
    Text(item['equipment'] == true ? '+${item['upgrade']}${number(item['merge']) > 0 ? ' · ◆${item['merge']}' : ''}' : '×${item['quantity']}', style: const TextStyle(color: gold, fontSize: 11)),
  ]))));

  Widget details(Item item) {
    Item? wearing; for (final candidate in equipped) {if (candidate['type'] == item['type']) wearing = candidate;}
    final currentStats = {for (final stat in rows(wearing?['stats'])) stat['key']: stat};
    final newStats = {for (final stat in rows(item['stats'])) stat['key']: stat};
    final statKeys = {...currentStats.keys, ...newStats.keys};
    final isEquipped = item['equipped'] == true;
    final protected = isEquipped || item['locked'] == true || item['bound'] == true;
    return Column(children: [Padding(padding: const EdgeInsets.fromLTRB(16,8,8,0), child: Row(children: [Expanded(child: Text(s('Свойства'), style: const TextStyle(color: gold, fontSize: 16))), IconButton(onPressed: busy ? null : () => setState(() {selectedId = null;}), icon: const Icon(Icons.close), tooltip: s('Закрыть'))])),
      Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(18,8,18,80), children: [
        Center(child: artwork(item, 76)), const SizedBox(height: 12), Text('${item['name']}', textAlign: TextAlign.center, style: TextStyle(color: rarityColor(item), fontWeight: FontWeight.bold, fontSize: 20)),
        const SizedBox(height: 6), Text('${item['rarityLabel']} · ${item['typeLabel']} · ${s('Ур.')} ${item['level']}', textAlign: TextAlign.center, style: const TextStyle(color: muted, fontSize: 12)),
        const SizedBox(height: 12), Wrap(alignment: WrapAlignment.center, spacing: 8, runSpacing: 8, children: [Chip(label: Text('${s('Заточка')} +${item['upgrade']}')), Chip(label: Text('${s('Объединение')} ◆${item['merge']}'))]),
        if ('${item['description'] ?? ''}'.isNotEmpty) Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Text('${item['description']}', style: const TextStyle(color: muted, fontSize: 12))),
        if (item['equipment'] == true) ...[
          const SizedBox(height: 14), Text(s(!isEquipped && wearing != null ? 'Сравнение с надетым' : 'Характеристики'), style: const TextStyle(color: gold, fontSize: 13)), const SizedBox(height: 8),
          for (final key in statKeys) Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(children: [Expanded(child: Text('${(newStats[key] ?? currentStats[key])?['label']}', style: const TextStyle(color: muted, fontSize: 12))),
            if (!isEquipped && wearing != null) Text('${currentStats[key]?['value'] ?? 0} → ', style: const TextStyle(color: muted, fontSize: 12)), Text('${newStats[key]?['value'] ?? 0}', style: const TextStyle(color: ink, fontSize: 12))])),
        ],
        const Divider(height: 28),
        if (!canAct) Text(s('Действия доступны в поселении.'), style: const TextStyle(color: gold)),
        Wrap(spacing: 8, runSpacing: 8, children: [
          OutlinedButton.icon(onPressed: busy || !canAct ? null : () => act('lock', id: item['id']), icon: Icon(item['locked'] == true ? Icons.lock_open : Icons.lock_outline, size: 17), label: Text(s(item['locked'] == true ? 'Отпереть' : 'Запереть'))),
          if (item['equipment'] == true) FilledButton.icon(onPressed: busy || !canAct || item['canEquip'] != true ? null : () => act(isEquipped ? 'unequip' : 'equip', id: item['id']), icon: Icon(isEquipped ? Icons.remove_circle_outline : Icons.check_circle_outline, size: 17), label: Text(s(isEquipped ? 'Снять' : 'Надеть'))),
          if (item['equipment'] == true) OutlinedButton(onPressed: busy ? null : () => act('blacksmith'), child: Text(s('Кузница'))),
        ]),
        if (!protected) ...[
          const SizedBox(height: 14),
          OutlinedButton.icon(onPressed: busy || !canAct ? null : () async {if (await confirm(s('Продать предмет?'), '${item['name']} · +${item['saleGold'] ?? item['price']} ${s('Золото')}\n${s('Предмет будет удалён из инвентаря.')}')) await act('sell', id: item['id']);}, icon: const Icon(Icons.toll, size: 17), label: Text('${s('Продать')} · ${item['saleGold'] ?? item['price']}')),
          if (item['equipment'] == true) OutlinedButton.icon(onPressed: busy || !canAct ? null : () async {if (await confirm(s('Разобрать предмет?'), '${item['name']}\n+${item['yield']?['silver'] ?? 0} ${s('Серебро')} · +${item['yield']?['ore'] ?? 0} ${s('Ресурсы')}\n${s('Предмет будет удалён из инвентаря.')}')) await act('disassemble', id: item['id']);}, icon: const Icon(Icons.handyman_outlined, size: 17), label: Text(s('Разобрать'))),
        ],
      ])),
    ]);
  }
  Future<void> showBulk() async {
    if (widget.data['premium'] != true) {await act('premium'); return;}
    final rarities = <String>{'common'}; bool keep = true; String type = 'all';
    await showModalBottomSheet<void>(context: context, isScrollControlled: true, useSafeArea: true, builder: (sheet) => StatefulBuilder(builder: (c, change) {
      final candidates = bag.where((i) => i['equipment'] == true && !['pickaxe','alchemyTool'].contains(i['type']) && i['locked'] != true && i['bound'] != true && rarities.contains(i['rarity']) && (type == 'all' || type == i['type']) && (!keep || number(i['upgrade']) == 0 && number(i['merge']) == 0)).toList();
      final goldTotal = candidates.fold<int>(0, (sum,i) => sum + number(i['price']) * number(i['quantity']));
      final silverTotal = candidates.fold<int>(0, (sum,i) => sum + number(i['yield']?['silver']) * number(i['quantity']));
      final oreTotal = candidates.fold<int>(0, (sum,i) => sum + number(i['yield']?['ore']) * number(i['quantity']));
      return FractionallySizedBox(heightFactor: .9, child: ListView(padding: const EdgeInsets.all(18), children: [
        Text(s('Массовая продажа и разбор'), style: const TextStyle(fontSize: 18, color: gold)), const SizedBox(height: 14),
        Wrap(spacing: 6, children: rows(widget.data['rarities']).map((r) => FilterChip(label: Text('${r['label']}'), selected: rarities.contains(r['id']), onSelected: (selected) => change(() {if (selected) {rarities.add(r['id']);} else {rarities.remove(r['id']);}}))).toList()),
        DropdownButton<String>(value: type, isExpanded: true, items: [DropdownMenuItem(value: 'all', child: Text(s('Все типы снаряжения'))), ...rows(widget.data['slots']).where((v) => !['pickaxe','alchemyTool'].contains(v['id'])).map((v) => DropdownMenuItem<String>(value: v['id'], child: Text('${v['label']}')))], onChanged: (v) => change(() {type = v!;})),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(s('Сохранить усиленные вещи'), style: const TextStyle(fontSize: 12)), value: keep, onChanged: (v) => change(() {keep = v;})),
        Text('${s('Выбранные предметы')}: ${candidates.length} · +$goldTotal ${s('Золото')}', style: const TextStyle(color: gold)),
        Text('${s('Разобрать')}: +$silverTotal ${s('Серебро')} · +$oreTotal ${s('Ресурсы')}', style: const TextStyle(color: muted, fontSize: 12)),
        const SizedBox(height: 8),
        for (final action in ['sell','disassemble']) Padding(padding: const EdgeInsets.only(top: 8), child: FilledButton.tonal(onPressed: candidates.isEmpty ? null : () async {
          final ids = candidates.map((i) => i['id']).toList();
          final accepted = await confirm(s(action == 'sell' ? 'Продать' : 'Разобрать'), '${s('Предметы будут удалены из инвентаря.')}\n\n${candidates.take(40).map((i) => '${i['name']} ×${i['quantity']}').join('\n')}${candidates.length > 40 ? '\n…' : ''}');
          if (!accepted || !mounted) return;
          if (sheet.mounted) Navigator.pop(sheet);
          await act('bulk', extra: {'action': action, 'filters': {'rarities': rarities.toList(), 'type': type, 'keepUpgraded': keep}, 'ids': ids});
        }, child: Text(s(action == 'sell' ? 'Продать' : 'Разобрать')))),
        const SizedBox(height: 12), TextButton(onPressed: () => Navigator.pop(sheet), child: Text(s('Закрыть'))),
      ]));
    }));
  }
}

IconData typeIcon(String type) => switch (type) {
  'weapon' => Icons.gavel, 'offhand' || 'armor' || 'helmet' => Icons.shield_outlined,
  'ring' || 'amulet' || 'artifact' => Icons.diamond_outlined,
  'potion' || 'alchemyTool' => Icons.science_outlined, 'pickaxe' || 'ore' => Icons.construction,
  _ => Icons.inventory_2_outlined,
};
