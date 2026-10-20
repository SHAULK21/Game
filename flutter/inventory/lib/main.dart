import 'dart:convert';
import 'dart:js_interop';
import 'package:flutter/widgets.dart';
import 'inventory.dart';

@JS('aethelgardInventoryUpdate')
external set inventoryUpdate(JSFunction callback);
@JS('aethelgardInventoryAction')
external JSPromise<JSString> inventoryAction(JSString request);

final projection = ValueNotifier<Map<String, dynamic>>({});
void main() {
  inventoryUpdate = ((JSString encoded) {
    projection.value = Map<String, dynamic>.from(jsonDecode(encoded.toDart));
  }).toJS;
  runWidget(const InventoryViews());
}

class InventoryViews extends StatefulWidget {
  const InventoryViews({super.key});
  @override
  State<InventoryViews> createState() => _InventoryViewsState();
}
class _InventoryViewsState extends State<InventoryViews> with WidgetsBindingObserver {
  @override
  void initState() {super.initState(); WidgetsBinding.instance.addObserver(this);}
  @override
  void didChangeMetrics() {if (mounted) setState(() {});}
  @override
  void dispose() {WidgetsBinding.instance.removeObserver(this); super.dispose();}
  @override
  Widget build(BuildContext context) => ViewCollection(views: [
    for (final view in WidgetsBinding.instance.platformDispatcher.views)
      View(view: view, child: ValueListenableBuilder<Map<String, dynamic>>(
        valueListenable: projection,
        builder: (_, data, _) => InventoryApp(key: ValueKey(data['owner']), data: data, onAction: (request) async {
          final response = await inventoryAction(jsonEncode(request).toJS).toDart;
          return Map<String, dynamic>.from(jsonDecode(response.toDart));
        }),
      )),
  ]);
}
