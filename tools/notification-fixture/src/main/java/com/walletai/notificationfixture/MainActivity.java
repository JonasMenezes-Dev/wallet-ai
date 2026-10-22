package com.walletai.notificationfixture;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.util.concurrent.atomic.AtomicInteger;

/** No network, bank accounts, JS, financial writes or real personal information. */
public final class MainActivity extends Activity {
  private static final String CHANNEL = "wallet_fictional_notifications";
  private static final String REPEAT_EXTRA = "wallet.fixture.repeat_delivery";
  // Purely descriptive; the Wallet always uses the real StatusBarNotification package.
  private static final String SIMULATED_SOURCE_EXTRA = "wallet.fixture.simulated_source";
  private static final AtomicInteger IDS = new AtomicInteger((int) (System.currentTimeMillis() & 0x3fffffff));
  private static final String[] LABELS = {
    "Pix enviado", "Pix recebido", "Compra no débito", "Compra no crédito",
    "Wallet / NFC simulado", "Estorno", "Compra incompleta", "OTP fictício (deve ser bloqueado)",
    "Promoção (revisão sem registro)", "Par banco + wallet (mesma compra simulada)"
  };
  private static final String[] MESSAGES = {
    "Pix enviado de R$ 12,34 para PESSOA FICTÍCIA. Simulação Wallet AI.",
    "Pix recebido de R$ 56,78 de PESSOA FICTÍCIA. Simulação Wallet AI.",
    "Compra aprovada no débito de R$ 23,45 em LOJA FICTÍCIA. Simulação Wallet AI.",
    "Compra aprovada no cartão de crédito de R$ 67,89 em LOJA FICTÍCIA. Simulação Wallet AI.",
    "Compra aprovada por aproximação NFC de R$ 45,67 em LOJA FICTÍCIA. Origem simulada: wallet. Simulação Wallet AI.",
    "Estorno de compra de R$ 23,45 em LOJA FICTÍCIA. Simulação Wallet AI.",
    "Compra aprovada em LOJA FICTÍCIA. Valor não informado. Simulação Wallet AI.",
    "Seu código de segurança fictício é 123456. Não é uma compra. Simulação Wallet AI.",
    "Promoção: ganhe R$ 10,00 de desconto em LOJA FICTÍCIA. Oferta fictícia, sem compra. Simulação Wallet AI.",
    "Compra aprovada no crédito de R$ 34,56 em LOJA FICTÍCIA. Referência fictícia: DEMO-PAR-01. Origem simulada: banco. Simulação Wallet AI."
  };
  private CheckBox repeatDelivery;

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0) {
      finish();
      return;
    }
    NotificationManager manager = getSystemService(NotificationManager.class);
    manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Simulações fictícias", NotificationManager.IMPORTANCE_DEFAULT));

    LinearLayout content = new LinearLayout(this);
    content.setOrientation(LinearLayout.VERTICAL);
    int padding = (int) (20 * getResources().getDisplayMetrics().density);
    content.setPadding(padding, padding, padding, padding);
    content.setBackgroundColor(Color.rgb(244, 247, 244));
    TextView title = new TextView(this);
    title.setText("Wallet AI · emissor fictício");
    title.setTextSize(22);
    content.addView(title);
    TextView description = new TextView(this);
    description.setText("Somente desenvolvimento. Dados fictícios. NFC e origens banco/wallet são simulados; o emissor continua com seu próprio pacote. Autorize este aplicativo explicitamente no Wallet antes de ativar a captura. OTP não deve ser persistido.");
    description.setPadding(0, padding, 0, padding);
    content.addView(description);
    repeatDelivery = new CheckBox(this);
    repeatDelivery.setText("Reentregar o mesmo evento (teste de duplicação)");
    content.addView(repeatDelivery);
    for (int index = 0; index < LABELS.length; index++) {
      final int scenario = index;
      Button button = new Button(this);
      button.setText(LABELS[index]);
      button.setAllCaps(false);
      button.setTextColor(Color.WHITE);
      button.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(23, 77, 61)));
      button.setOnClickListener(view -> send(scenario));
      content.addView(button);
    }
    ScrollView scroll = new ScrollView(this);
    scroll.setFitsSystemWindows(true);
    scroll.addView(content);
    setContentView(scroll);
  }

  private void send(int scenario) {
    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
      Toast.makeText(this, "Após autorizar, toque novamente no cenário.", Toast.LENGTH_SHORT).show();
      return;
    }
    Bundle extras = new Bundle();
    extras.putBoolean(REPEAT_EXTRA, repeatDelivery.isChecked());
    extras.putString(SIMULATED_SOURCE_EXTRA, scenario == 4 ? "wallet" : "bank");
    Notification notification = new Notification.Builder(this, CHANNEL)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle("TESTE · " + LABELS[scenario])
      .setContentText(MESSAGES[scenario])
      .setStyle(new Notification.BigTextStyle().bigText(MESSAGES[scenario]))
      .addExtras(extras)
      .setAutoCancel(true)
      .build();
    NotificationManager manager = getSystemService(NotificationManager.class);
    // Clear older events to avoid auto-group summaries; the simulated pair keeps two active.
    manager.cancelAll();
    manager.notify(IDS.incrementAndGet(), notification);
    if (scenario == 9) {
      Bundle walletExtras = new Bundle();
      walletExtras.putString(SIMULATED_SOURCE_EXTRA, "wallet");
      walletExtras.putBoolean(REPEAT_EXTRA, repeatDelivery.isChecked());
      String walletMessage = "Compra aprovada no crédito de R$ 34,56 em LOJA FICTÍCIA. Referência fictícia: DEMO-PAR-01. Origem simulada: wallet. Simulação Wallet AI.";
      manager.notify(IDS.incrementAndGet(), new Notification.Builder(this, CHANNEL)
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setContentTitle("TESTE · Wallet (mesma compra simulada)")
        .setContentText(walletMessage)
        .setStyle(new Notification.BigTextStyle().bigText(walletMessage))
        .addExtras(walletExtras).setAutoCancel(true).build());
    }
    Toast.makeText(this, "Notificação fictícia enviada.", Toast.LENGTH_SHORT).show();
  }
}
