import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:aethelgard_inventory/inventory.dart';

Map<String,dynamic> sword(String id, {bool locked = false}) => {'id':id,'name':'Боевой меч','type':'weapon','typeLabel':'Оружие','rarity':'rare','rarityLabel':'Редкий','color':'6da9ed','level':5,'upgrade':7,'merge':2,'image':null,'description':'Меч испытателя','quantity':1,'equipped':false,'locked':locked,'bound':false,'equipment':true,'price':42,'score':100,'stats':[{'key':'attack','label':'Атака','value':156}],'yield':{'silver':4,'ore':1},'canEquip':true};
Map<String,dynamic> fixture() => {'owner':'test-owner','name':'Испытатель','level':5,'gold':500,'silver':100,'used':1,'capacity':40,'premium':true,'expansionCost':2400,'canAct':true,'items':[sword('a')],'equipped':<Map<String,dynamic>>[],'slots':[{'id':'weapon','label':'Оружие'}],'rarities':[{'id':'rare','label':'Редкий','color':'6da9ed'}],'labels':<String,String>{}};

void main() {
  testWidgets('narrow mobile inventory renders, searches and sends only item identity', (tester) async {
    tester.view.physicalSize = const Size(320,650); tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize); addTearDown(tester.view.resetDevicePixelRatio);
    final calls = <Map<String,dynamic>>[];
    await tester.pumpWidget(InventoryApp(data:fixture(),onAction:(request) async {calls.add(request);return {'success':true,'message':'Готово.'};}));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.enterText(find.byKey(const ValueKey('inventory-search')), 'несуществующий');await tester.pump();
    expect(find.text('Ничего не найдено'),findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('inventory-search')), 'меч');await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('item-a')));await tester.tap(find.byKey(const ValueKey('item-a')));await tester.pumpAndSettle();
    expect(find.text('Заточка +7'),findsOneWidget);expect(find.text('Объединение ◆2'),findsOneWidget);
    await tester.ensureVisible(find.text('Надеть'));await tester.tap(find.text('Надеть'));await tester.pumpAndSettle();
    expect(calls.single, {'owner':'test-owner','type':'equip','id':'a'});
    expect(tester.takeException(),isNull);
  });
  testWidgets('protected equipment has no destructive actions and field disables equipment commands', (tester) async {
    final data=fixture();data['items']=[sword('a',locked:true)];data['canAct']=false;
    await tester.pumpWidget(InventoryApp(data:data,onAction:(_) async => throw StateError('must not execute')));await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const ValueKey('item-a')));await tester.tap(find.byKey(const ValueKey('item-a')));await tester.pumpAndSettle();
    expect(find.text('Продать · 42'),findsNothing);expect(find.text('Разобрать'),findsNothing);
    final equip=tester.widget<FilledButton>(find.widgetWithText(FilledButton,'Надеть'));
    expect(equip.onPressed,isNull);expect(tester.takeException(),isNull);
  });
}
