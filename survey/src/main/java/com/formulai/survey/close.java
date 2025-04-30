import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SurveyClose {

    @PostMapping("/close")
    public String root(@RequestParam Bool forceClose) {
        return { "message": "Not implemented yet" };
    }
}