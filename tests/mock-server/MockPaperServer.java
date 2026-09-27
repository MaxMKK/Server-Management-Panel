import java.io.BufferedReader;
import java.io.InputStreamReader;

/**
 * MockPaperServer
 * เซิร์ฟเวอร์จำลองพฤติกรรมของ Paper Minecraft Server บน Windows สำหรับทดสอบ Process Agent
 */
public class MockPaperServer {
    public static void main(String[] args) {
        System.out.println("[INFO] [ServerMain] Building runtime configuration");
        System.out.println("[INFO] [ServerMain] Starting Minecraft server version 1.21.1");
        System.out.println("[INFO] Loading properties");
        System.out.println("[INFO] Default game type: SURVIVAL");
        System.out.println("[INFO] Generating keypair");
        System.out.println("[INFO] Starting Minecraft server on *:25565");
        System.out.println("[INFO] Preparing level \"world\"");
        System.out.println("[INFO] Preparing start region for dimension minecraft:overworld");
        System.out.println("[INFO] Time elapsed: 1200 ms");
        System.out.println("[INFO] Done (1.850s)! For help, type \"help\"");
        System.out.flush();

        // รัน Thread คอยรับคำสั่งจาก stdin (stdin pipe)
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(System.in))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.equalsIgnoreCase("save-all")) {
                    System.out.println("[INFO] Saved the game");
                    System.out.flush();
                } else if (line.equalsIgnoreCase("stop")) {
                    System.out.println("[INFO] Stopping the server");
                    System.out.println("[INFO] Saving worlds");
                    System.out.println("[INFO] ThreadedAnvilChunkStorage (world): All dimensions are saved");
                    System.out.println("[INFO] Closing Server");
                    System.out.flush();
                    System.exit(0);
                } else {
                    System.out.println("[INFO] Unknown command: " + line);
                    System.out.flush();
                }
            }
        } catch (Exception e) {
            System.err.println("[ERROR] Exception in server loop: " + e.getMessage());
            System.exit(1);
        }
    }
}
