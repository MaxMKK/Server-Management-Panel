import java.io.*;
import java.net.*;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;

/**
 * MockPaperServer
 * เซิร์ฟเวอร์จำลองพฤติกรรมของ Paper Minecraft Server บน Windows
 * รองรับทั้ง Console stdin และ Source RCON Protocol บน TCP Socket (Port 25575)
 */
public class MockPaperServer {
    private static final int RCON_PORT = 25575;
    private static final String RCON_PASSWORD = "SuperSecretRconPassword2026!";
    private static volatile boolean running = true;

    public static void main(String[] args) {
        System.out.println("[INFO] [ServerMain] Building runtime configuration");
        System.out.println("[INFO] [ServerMain] Starting Minecraft server version 1.21.1");
        System.out.println("[INFO] Loading properties");
        System.out.println("[INFO] Default game type: SURVIVAL");
        System.out.println("[INFO] Generating keypair");
        System.out.println("[INFO] Starting Minecraft server on *:25565");
        System.out.println("[INFO] RCON running on 0.0.0.0:" + RCON_PORT);
        System.out.println("[INFO] Preparing level \"world\"");
        System.out.println("[INFO] Preparing start region for dimension minecraft:overworld");
        System.out.println("[INFO] Time elapsed: 1200 ms");
        System.out.println("[INFO] Done (1.850s)! For help, type \"help\"");
        System.out.flush();

        // 1. รัน RCON Server Socket ใน Background Thread
        Thread rconThread = new Thread(MockPaperServer::startRconServer);
        rconThread.setDaemon(true);
        rconThread.start();

        // 2. รับคำสั่งจาก stdin (Console pipe)
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(System.in))) {
            String line;
            while (running && (line = reader.readLine()) != null) {
                line = line.trim();
                handleConsoleCommand(line);
            }
        } catch (Exception e) {
            System.err.println("[ERROR] Exception in server loop: " + e.getMessage());
            System.exit(1);
        }
    }

    private static void handleConsoleCommand(String line) {
        if (line.equalsIgnoreCase("save-all")) {
            System.out.println("[INFO] Saved the game");
            System.out.flush();
        } else if (line.equalsIgnoreCase("stop")) {
            System.out.println("[INFO] Stopping the server");
            System.out.println("[INFO] Saving worlds");
            System.out.println("[INFO] ThreadedAnvilChunkStorage (world): All dimensions are saved");
            System.out.println("[INFO] Closing Server");
            System.out.flush();
            running = false;
            System.exit(0);
        } else {
            System.out.println("[INFO] [Console] Executed: " + line);
            System.out.flush();
        }
    }

    /**
     * RCON TCP Listener จำลอง Source RCON Protocol
     */
    private static void startRconServer() {
        try (ServerSocket serverSocket = new ServerSocket(RCON_PORT)) {
            while (running) {
                try {
                    Socket socket = serverSocket.accept();
                    new Thread(() -> handleRconClient(socket)).start();
                } catch (Exception e) {
                    if (!running) break;
                }
            }
        } catch (Exception e) {
            System.err.println("[RCON] ไม่สามารถเปิด Socket ได้: " + e.getMessage());
        }
    }

    private static void handleRconClient(Socket socket) {
        boolean authenticated = false;
        try (InputStream in = socket.getInputStream();
             OutputStream out = socket.getOutputStream()) {

            byte[] header = new byte[12];
            while (running) {
                int read = in.readNBytes(header, 0, 12);
                if (read < 12) break;

                ByteBuffer bb = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN);
                int length = bb.getInt();
                int reqId = bb.getInt();
                int type = bb.getInt();

                int bodyLength = length - 8;
                byte[] bodyBytes = in.readNBytes(bodyLength);
                if (bodyBytes.length < bodyLength) break;

                // ตัด null terminator 2 ตัวท้าย
                String body = new String(bodyBytes, 0, Math.max(0, bodyLength - 2), StandardCharsets.UTF_8);

                if (type == 3) {
                    // AUTH
                    if (RCON_PASSWORD.equals(body)) {
                        authenticated = true;
                        sendRconPacket(out, reqId, 2, "");
                    } else {
                        sendRconPacket(out, -1, 2, "");
                    }
                } else if (type == 2) {
                    // EXECCOMMAND
                    if (!authenticated) {
                        sendRconPacket(out, -1, 0, "Not authenticated");
                        continue;
                    }

                    String response = executeMinecraftRconCommand(body);
                    sendRconPacket(out, reqId, 0, response);
                }
            }
        } catch (Exception ignored) {
        } finally {
            try { socket.close(); } catch (Exception ignored) {}
        }
    }

    private static String executeMinecraftRconCommand(String cmd) {
        cmd = cmd.trim();
        if (cmd.equalsIgnoreCase("list")) {
            return "There are 0 of a max of 20 players online:";
        } else if (cmd.equalsIgnoreCase("version")) {
            return "This server is running Paper version git-Paper-1.21.1 (MC: 1.21.1)";
        } else if (cmd.equalsIgnoreCase("save-all")) {
            return "Saved the game";
        } else if (cmd.startsWith("say ")) {
            String msg = cmd.substring(4);
            System.out.println("[Server] " + msg);
            System.out.flush();
            return "[Server] " + msg;
        } else {
            return "Unknown or incomplete command: " + cmd;
        }
    }

    private static void sendRconPacket(OutputStream out, int id, int type, String body) throws IOException {
        byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
        int length = 4 + 4 + bodyBytes.length + 2;

        ByteBuffer bb = ByteBuffer.allocate(4 + length).order(ByteOrder.LITTLE_ENDIAN);
        bb.putInt(length);
        bb.putInt(id);
        bb.putInt(type);
        bb.put(bodyBytes);
        bb.put((byte) 0);
        bb.put((byte) 0);

        out.write(bb.array());
        out.flush();
    }
}
